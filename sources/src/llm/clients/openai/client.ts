import OpenAI from "openai";
import { executeFileTool } from "../../../tools/executor/index.js";
import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";

import {
  AgentRequest,
  AgentResponse,
  Message,
  ToolDefinition,
} from "../../../types/agent/index.js";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems.js";
import { buildInput, toOpenAITools } from "./internal/index.js";
import { tryParseStringKeyedObject } from "../../../utils/data/index.js";
import { validateRequiredArguments } from "../../../utils/tools/tool.guards.js";

/**
 * Implementación del cliente OpenAI.
 *
 * Esta clase adapta el SDK oficial de OpenAI
 * al contrato definido por la interfaz LlmClient.
 *
 * Gracias a esto, el resto de la aplicación
 * no necesita conocer detalles específicos
 * de OpenAI.
 */
export class OpenAiClient implements LlmClient {
  /**
   * Instancia privada del SDK oficial.
   */
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  private async create(
    input: string | OpenAI.Responses.ResponseInput,
    max_tokens: number,
    systemPrompt?: string,
    messages?: Message[],
    previousResponseId?: string,
    tools?: ToolDefinition[],
  ) {
    return await this.client.responses.create({
      model: config.openaiModel,
      ...(systemPrompt && {
        instructions: systemPrompt,
      }),
      ...(previousResponseId && {
        previous_response_id: previousResponseId,
      }),

      input:
        typeof input === "string"
          ? buildInput({
              prompt: input,
              messages,
            })
          : input,
      max_output_tokens: max_tokens,

      tools: toOpenAITools(tools),
    });
  }

  private async createStream(
    input: string | OpenAI.Responses.ResponseInput,
    max_tokens: number,
    systemPrompt?: string,
    messages?: Message[],
    previousResponseId?: string,
    tools?: ToolDefinition[],
  ) {
    return this.client.responses.stream({
      model: config.openaiModel,
      ...(systemPrompt && {
        instructions: systemPrompt,
      }),
      ...(previousResponseId && {
        previous_response_id: previousResponseId,
      }),

      input:
        typeof input === "string"
          ? buildInput({
              prompt: input,
              messages,
            })
          : input,
      max_output_tokens: max_tokens,

      tools: toOpenAITools(tools),
    });
  }

  /**
   * Genera una respuesta completa.
   *
   * Espera a que el modelo termine la generación
   * antes de retornar el resultado.
   */
  async ask({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    const response = await this.create(
      prompt,
      config.max_tokens,
      systemPrompt,
      messages,
    );

    const text = response.output_text;

    if (!text) {
      return {
        text: "OpenAI no retornó contenido de texto en la respuesta",
        totalInputTokens: response.usage?.input_tokens ?? 0,
        totalOutputTokens: response.usage?.output_tokens ?? 0,
        toolsUsed: [],
      };
    }

    return {
      text,
      totalInputTokens: response.usage?.input_tokens ?? 0,
      totalOutputTokens: response.usage?.output_tokens ?? 0,
      toolsUsed: [],
    };
  }

  /**
   * Genera una respuesta utilizando streaming.
   *
   * Mientras el modelo genera contenido,
   * este se imprime en consola y se acumula
   * en la variable fullResponse.
   */
  async stream({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    let fullResponse = "";
    const stream = await this.createStream(
      prompt,
      config.max_tokens,
      systemPrompt,
      messages,
    );

    /**
     * Se ejecuta cada vez que OpenAI
     * genera un nuevo fragmento de texto.
     */
    stream.on("response.output_text.delta", (event) => {
      process.stdout.write(event.delta);
      fullResponse += event.delta;
    });

    /**
     * Espera a que finalice completamente
     * la generación de la respuesta.
     */
    const finalResponse = await stream.finalResponse();

    /**
     * Salto de línea para mejorar la
     * visualización en consola.
     */
    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens: finalResponse.usage?.input_tokens ?? 0,
      totalOutputTokens: finalResponse.usage?.output_tokens ?? 0,
      toolsUsed: [],
    };
  }

  /**
   * Ejecuta una conversación con OpenAI permitiendo que el modelo invoque
   * herramientas durante el proceso.
   *
   * El flujo se repite hasta que:
   * - El modelo genera una respuesta final.
   * - Se alcanza el límite máximo de iteraciones.
   * - OpenAI retorna una respuesta sin texto ni llamadas a herramientas.
   *
   * @param prompt Mensaje inicial enviado por el usuario.
   * @param systemPrompt Instrucciones opcionales para el modelo.
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
    // Acumula el consumo total de todas las llamadas al modelo.
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const toolsUsed = new Set<string>();

    /**
     * Registra las llamadas ya ejecutadas.
     *
     * Evita que el modelo invoque indefinidamente la misma
     * herramienta con exactamente los mismos argumentos.
     */
    const executedToolCalls = new Set<string>();

    // Mantiene el historial completo en el formato nativo
    // de OpenAI Responses API.
    //
    // Este arreglo se modifica durante cada iteración agregando:
    // - los elementos generados por el modelo;
    // - los function_call;
    // - los function_call_output.
    const openAiInput: OpenAI.Responses.ResponseInput = buildInput({
      prompt,
      messages,
    });

    // Cada iteración representa una llamada al modelo.
    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      // Se envía siempre el historial completo acumulado.
      const response = await this.create(
        openAiInput,
        config.max_tokens_tools,
        systemPrompt,
        undefined,
        undefined,
        tools,
      );

      totalInputTokens += response.usage?.input_tokens ?? 0;
      totalOutputTokens += response.usage?.output_tokens ?? 0;

      const toolCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
          item.type === "function_call",
      );

      // console.dir(
      //   {
      //     model: response.model,
      //     content: response.output_text,
      //     toolCalls: toolCalls.map((toolCall) => ({
      //       callId: toolCall.call_id,
      //       name: toolCall.name,
      //       arguments: toolCall.arguments,
      //     })),
      //     doneReason:
      //       toolCalls.length > 0
      //         ? "tool_calls"
      //         : response.status === "completed"
      //           ? "stop"
      //           : (response.incomplete_details?.reason ?? response.status),
      //   },
      //   {
      //     depth: null,
      //   },
      // );

      /**
       * Si no hay tool calls, esperamos una respuesta textual final.
       */
      if (toolCalls.length === 0) {
        const text = response.output_text.trim();

        if (!text) {
          return {
            text: "OpenAI no retornó texto ni llamadas a herramientas.",
            totalInputTokens,
            totalOutputTokens,
            toolsUsed: [...toolsUsed],
          };
        }

        console.log("Respuesta final generada\n");

        return {
          text,
          totalInputTokens,
          totalOutputTokens,
          toolsUsed: [...toolsUsed],
        };
      }

      /**
       * Conserva todos los elementos generados por OpenAI:
       * function calls, reasoning y otros elementos reproducibles.
       */
      openAiInput.push(...toResponseInputItems(response.output));

      // Ejecuta todas las herramientas solicitadas en paralelo.
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const toolName = toolCall.name;

          const callId = toolCall.call_id;

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
            };
          }

          const params = tryParseStringKeyedObject(toolCall.arguments);

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
            };
          }

          executedToolCalls.add(callSignature);

          console.log(
            `Ejecutando tool: ${toolName} ` + `(${JSON.stringify(params)})`,
          );

          try {
            let output = await executeFileTool(toolName, params);
            toolsUsed.add(toolName);

            if (!output?.trim()) {
              output = JSON.stringify({
                success: false,
                error: "empty_tool_result",
                message: `La herramienta "${toolName}" no devolvió contenido.`,
              });
            }

            console.log(`Herramienta completada: ${toolCall.name}`);
            return {
              callId,
              name: toolName,
              output,
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
            };
          }
        }),
      );

      /**
       * Agrega los resultados de las herramientas al historial.
       *
       * call_id permite asociar cada resultado con el
       * function_call original generado por OpenAI.
       */
      for (const result of toolResults) {
        openAiInput.push({
          type: "function_call_output",
          call_id: result.callId,
          output: result.output,
        });
      }
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
