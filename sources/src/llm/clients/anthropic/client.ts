import Anthropic from "@anthropic-ai/sdk";

import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
} from "../../../types/agent/index.js";
import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";
import { executeFileTool } from "../../../tools/executor/index.js";
import {
  buildMessages,
  getAnthropicResponseText,
  extractAnthropicToolCalls,
  toAnthropicAssistantMessage,
  toAnthropicTools,
} from "./internal/index.js";
import { tryGetStringKeyedObject } from "../../../utils/data/index.js";
import { validateRequiredArguments } from "../../../utils/tools/tool.guards.js";

/**
 * Implementación del cliente Anthropic.
 *
 * Esta clase adapta el SDK de Anthropic
 * al contrato definido por la interfaz LlmClient.
 */
export class AnthropicClient implements LlmClient {
  /**
   * Instancia privada del SDK oficial.
   */
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Crea una instancia de un cliente
   * @param systemPrompt Prompt del sistema
   * @param max_tokens Número máximo de tokens que se permite usar en la conversación
   * @param messages Historial de la conversación
   * @param tools Herramientas que puede usar el llm
   * @returns Instancia del cliente del llm
   */
  private async create(
    systemPrompt: string,
    max_tokens: number,
    messages: Anthropic.Messages.MessageParam[],
    tools?: ToolDefinition[],
  ) {
    return await this.client.messages.create({
      model: config.anthropicModel,
      max_tokens,
      ...(systemPrompt && {
        system: systemPrompt,
      }),
      tools: toAnthropicTools(tools),
      messages,
    });
  }

  /**
   * Crea una instancia del cliente con respuesta stream
   * @param systemPrompt Prompt del sistema
   * @param max_tokens Número máximo de tokens que se permite usar en la conversación
   * @param messages Historial de la conversación
   * @param tools Herramientas que puede usar el llm
   * @returns Instancia del cliente del llm
   */
  private async createStream(
    systemPrompt: string,
    max_tokens: number,
    messages: Anthropic.Messages.MessageParam[],
    tools?: ToolDefinition[],
  ) {
    return this.client.messages.stream({
      model: config.anthropicModel,
      max_tokens: max_tokens,
      ...(systemPrompt && {
        system: systemPrompt,
      }),
      messages,
      tools: toAnthropicTools(tools),
    });
  }

  /**
   * Ejecuta una conversación con Anthropic
   *
   * Espera a que Claude termine la generación
   * antes de retornar el resultado.
   * @param prompt Mensaje inicial enviado por el usuario.
   * @param systemPrompt Instrucciones opcionales para controlar el comportamiento del modelo.
   * @param messages Historial de la coversacion
   * @returns Texto final generado por el modelo.
   */
  async ask({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    // Ejecutar la pregunta
    const response = await this.create(
      systemPrompt ?? "",
      config.max_tokens,
      buildMessages(prompt, messages),
    );

    // Obtener respusta
    const text = getAnthropicResponseText(response.content);

    if (!text) {
      return {
        text: "Anthropic no retornó contenido de texto en la respuesta",
        totalInputTokens: response.usage.input_tokens,
        totalOutputTokens: response.usage.output_tokens,
        toolsUsed: [],
      };
    }

    return {
      text,
      totalInputTokens: response.usage.input_tokens,
      totalOutputTokens: response.usage.output_tokens,
      toolsUsed: [],
    };
  }

  /**
   * Genera una respuesta utilizando streaming.
   *
   * @param prompt Mensaje inicial enviado por el usuario.
   * @param systemPrompt Instrucciones opcionales para controlar el comportamiento del modelo.
   * @param messages Historial de la coversacion
   * @returns Texto final generado por el modelo.
   */
  async stream({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    let fullResponse = "";

    const stream = await this.createStream(
      systemPrompt ?? "",
      config.max_tokens,
      buildMessages(prompt, messages),
    );

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    /**
     * Se ejecuta cada vez que Claude
     * genera un nuevo fragmento de texto.
     */
    stream.on("text", (chunk) => {
      process.stdout.write(chunk);

      fullResponse += chunk;
    });

    /**
     * Espera a que termine completamente
     * la generación del mensaje.
     */
    const finalMessage = await stream.finalMessage();
    totalInputTokens = finalMessage.usage.input_tokens;
    totalOutputTokens = finalMessage.usage.output_tokens;

    /**
     * Salto de línea para mejorar
     * la visualización en consola.
     */
    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens,
      totalOutputTokens,
      toolsUsed: [],
    };
  }

  /**
   * Ejecuta una conversación con Anthropic permitiendo que el modelo invoque
   * herramientas durante el proceso.
   *
   * El flujo se repite hasta que:
   * - El modelo genera una respuesta final.
   * - Se alcanza el límite máximo de iteraciones.
   * - Anthropic devuelve una razón de finalización inesperada.
   *
   * @param prompt Mensaje inicial enviado por el usuario.
   * @param systemPrompt Instrucciones opcionales para controlar el comportamiento del modelo.
   * @param messages Historial de la conversación.
   * @param tools Herramientas disponibles para el modelo.
   * @returns Respuesta final generada por el modelo.
   */
  async askWithTools({
    prompt,
    systemPrompt,
    messages,
    tools,
  }: AgentRequest): Promise<AgentResponse> {
    // Acumula los tokens utilizados en todas las llamadas realizadas
    // durante el ciclo de herramientas.
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Registra los nombres de las herramientas ejecutadas.
    const toolsUsed = new Set<string>();

    /**
     * Registra las llamadas ya ejecutadas.
     *
     * Evita que el modelo invoque indefinidamente la misma
     * herramienta con exactamente los mismos argumentos.
     */
    const executedToolCalls = new Set<string>();

    // Mantiene el historial completo en el formato nativo de Anthropic.
    //
    // Este arreglo se modifica durante cada iteración agregando:
    // - respuestas del asistente con tool_use;
    // - mensajes del usuario con tool_result.
    const anthropicMessages: Anthropic.Messages.MessageParam[] = buildMessages(
      prompt,
      messages,
    );

    // Cada iteración representa una llamada al modelo.
    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      // IMPORTANTE:
      // Se envía anthropicMessages y no se vuelve a construir el historial.
      //
      // Así Claude recibe los bloques tool_use y tool_result agregados
      // durante las iteraciones anteriores.
      const response = await this.create(
        systemPrompt ?? "",
        config.max_tokens_tools,
        anthropicMessages,
        tools,
      );

      // Acumula el consumo de esta llamada al modelo.
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const toolCalls = extractAnthropicToolCalls(response.content);

      const content = getAnthropicResponseText(response.content);

      console.dir(
        {
          responseId: response.id,
          model: response.model,
          content,
          toolCalls: toolCalls.map((toolCall) => ({
            callId: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.input ?? {},
          })),

          doneReason:
            response.stop_reason === "tool_use"
              ? "tool_calls"
              : response.stop_reason === "end_turn"
                ? "stop"
                : (response.stop_reason ?? "unknown"),

          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens:
              response.usage.input_tokens + response.usage.output_tokens,
          },
        },
        {
          depth: null,
        },
      );

      /**
       * Claude terminó normalmente.
       */
      if (response.stop_reason === "end_turn") {
        if (!content) {
          return {
            text: "Anthropic no retornó contenido de texto en la respuesta.",
            totalInputTokens,
            totalOutputTokens,
            toolsUsed: [...toolsUsed],
          };
        }

        console.log("Respuesta final generada\n");

        return {
          text: content,
          totalInputTokens,
          totalOutputTokens,
          toolsUsed: [...toolsUsed],
        };
      }

      /**
       * Claude solicitó ejecutar herramientas.
       */
      if (response.stop_reason === "tool_use") {
        if (toolCalls.length === 0) {
          return {
            text:
              "Anthropic indicó tool_use, pero no retornó " +
              "ninguna llamada a herramientas.",
            totalInputTokens,
            totalOutputTokens,
            toolsUsed: [...toolsUsed],
          };
        }

        /**
         * Conserva intacto el mensaje del asistente.
         *
         * Debe estar inmediatamente antes del mensaje
         * de usuario que contiene los tool_result.
         */
        anthropicMessages.push(toAnthropicAssistantMessage(response.content));

        // Ejecuta todas las herramientas solicitadas en paralelo.
        const toolResults = await Promise.all(
          toolCalls.map(async (toolCall) => {
            const toolName = toolCall.name;
            const callId = toolCall.id;

            const currentTool = tools?.find((tool) => tool.name === toolName);

            if (!currentTool) {
              return {
                callId,
                name: toolName,
                output: JSON.stringify({
                  success: false,
                  error: "tool_not_found",
                  message: `La herramienta "${toolName}" no está registrada.`,
                }),
                isError: true,
              };
            }

            const params = tryGetStringKeyedObject(toolCall.input);
            if (!params) {
              return {
                callId,
                name: toolName,
                output: JSON.stringify({
                  success: false,
                  error: "invalid_arguments",
                  message:
                    `Los argumentos de "${toolName}" ` +
                    "no contienen un objeto JSON válido.",
                }),
                isError: true,
              };
            }

            const validation = validateRequiredArguments(currentTool, params);
            if (!validation.valid) {
              return {
                callId,
                name: toolName,
                output: JSON.stringify({
                  success: false,
                  error: "missing_required_arguments",
                  message: `Faltan argumentos requeridos para "${toolName}".`,
                  missing: validation.missing,
                }),
                isError: true,
              };
            }

            /**
             * Se crea una firma estable para detectar
             * llamadas repetidas.
             *
             * En este caso JSON.stringify es suficiente porque
             * los argumentos provienen directamente del modelo.
             */
            const callSignature = JSON.stringify({
              name: toolName,
              arguments: params,
            });

            if (executedToolCalls.has(callSignature)) {
              console.warn(`Llamada duplicada detectada: ${toolName}`);
              return {
                callId,
                name: toolName,
                output: JSON.stringify({
                  success: false,
                  error: "duplicated_tool_call",
                  message:
                    `La herramienta "${toolName}" ya fue ejecutada ` +
                    "con los mismos argumentos.",
                }),
                isError: true,
              };
            }

            executedToolCalls.add(callSignature);

            console.log(
              `Ejecutando tool: ${toolName} ` + `(${JSON.stringify(params)})`,
            );

            try {
              let output = await executeFileTool(toolName!, params);
              toolsUsed.add(toolName!);

              if (!output?.trim()) {
                return {
                  callId,
                  name: toolName,
                  output: JSON.stringify({
                    success: false,
                    error: "empty_tool_result",
                    message:
                      `La herramienta "${toolName}" ` +
                      "no devolvió contenido.",
                  }),
                  isError: true,
                };
              }

              toolsUsed.add(toolName);

              console.log(`Herramienta completada: ${toolCall.name}`);
              return {
                callId,
                name: toolName,
                output,
                isError: false,
              };
            } catch (error) {
              return {
                callId,
                name: toolName,
                output: JSON.stringify({
                  success: false,
                  error: "tool_execution_failed",
                  message:
                    error instanceof Error
                      ? error.message
                      : "Error desconocido ejecutando la herramienta.",
                }),
                isError: true,
              };
            }
          }),
        );

        //Todos los tool_result deben estar en un único
        //mensaje con role "user".
        const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] =
          toolResults.map((toolResult) => ({
            type: "tool_result",
            tool_use_id: toolResult.callId,
            content: toolResult.output,
          }));

        anthropicMessages.push({
          role: "user",
          content: toolResultContent,
        });

        continue;
      }
      /**
       * Finalizaciones no normales.
       */
      console.warn(
        `Stop reason inesperado: ${response.stop_reason ?? "desconocido"}`,
      );

      return {
        text:
          content ||
          `Sesión terminada: ${response.stop_reason ?? "razón desconocida"}`,
        totalInputTokens,
        totalOutputTokens,
        toolsUsed: [...toolsUsed],
      };
    }

    console.warn(`Límite de ${config.max_iterations} iteraciones alcanzado`);

    return {
      text:
        `Lo siento, no pude completar la tarea en ${config.max_iterations} iteraciones. ` +
        "Intenta una pregunta más específica.",
      totalInputTokens,
      totalOutputTokens,
      toolsUsed: [...toolsUsed],
    };
  }
}
