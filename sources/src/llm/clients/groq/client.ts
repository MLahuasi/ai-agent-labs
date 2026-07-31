import { executeFileTool } from "../../../tools/executor/index.js";
import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";

import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
} from "../../../types/agent/index.js";
import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import {
  buildConversation,
  responseToMessage,
  toGroqTools,
} from "./internal/index.js";
import { validateRequiredArguments } from "../../../utils/tools/tool.guards.js";
import { tryParseStringKeyedObject } from "../../../utils/data/object.guards.js";

/**
 * Implementación del cliente Groq.
 *
 * Groq expone una API compatible con OpenAI Chat Completions,
 * por lo que se utiliza el SDK oficial de OpenAI configurando
 * el baseURL correspondiente.
 */
export class GroqClient implements LlmClient {
  /**
   * Instancia privada del SDK.
   */
  private readonly client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: config.groqApiKey,
    });
  }

  /**
   * Ejecuta una generación completa.
   *
   * Puede recibir:
   *
   * - un prompt simple;
   * - un historial nativo de Chat Completions.
   */
  private async create(
    maxTokens: number,
    messages: ChatCompletionMessageParam[],
    tools?: ToolDefinition[],
  ) {
    const convertedTools = toGroqTools(tools);

    return await this.client.chat.completions.create({
      model: config.groqModel,
      messages,
      max_tokens: maxTokens,
      ...(convertedTools && {
        tools: convertedTools,
        /**
         * Permite que el modelo decida si necesita
         * utilizar una herramienta.
         */
        tool_choice: "auto" as const,
        /**
         * Para llama-3.1-8b-instant es preferible
         * ejecutar una herramienta por turno.
         *
         * Esto reduce llamadas redundantes y hace
         * más predecible el agentic loop.
         */
        parallel_tool_calls: false,
      }),
    });
  }

  /**
   * Ejecuta una generación mediante streaming.
   */
  private async createStream(
    maxTokens: number,
    messages: ChatCompletionMessageParam[],
    tools?: ToolDefinition[],
  ) {
    const convertedTools = toGroqTools(tools);

    return await this.client.chat.completions.create({
      model: config.groqModel,
      stream: true,
      messages,
      max_tokens: maxTokens,
      ...(convertedTools && {
        tools: convertedTools,
        tool_choice: "auto" as const,
        parallel_tool_calls: false,
      }),
    });
  }

  /**
   * Genera una respuesta completa sin herramientas.
   */
  async ask({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    const response = await this.create(
      config.max_tokens,
      buildConversation({ prompt, systemPrompt, messages }),
    );

    const text = response.choices[0]?.message?.content;

    if (!text) {
      return {
        text: "Groq no retornó contenido de texto en la respuesta",
        totalInputTokens: response.usage?.prompt_tokens ?? 0,
        totalOutputTokens: response.usage?.completion_tokens ?? 0,
        toolsUsed: [],
      };
    }

    return {
      text,
      totalInputTokens: response.usage?.prompt_tokens ?? 0,
      totalOutputTokens: response.usage?.completion_tokens ?? 0,
      toolsUsed: [],
    };
  }

  /**
   * Genera una respuesta mediante streaming.
   */
  async stream({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    let fullResponse = "";
    let promptTokens = 0;
    let completionTokens = 0;
    // let totalTokens = 0;

    const stream = await this.createStream(
      config.max_tokens,
      buildConversation({ prompt, systemPrompt, messages }),
    );

    /**
     * Se ejecuta cada vez que Groq
     * genera un nuevo fragmento de texto.
     */
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";

      process.stdout.write(delta);
      fullResponse += delta;
      const usage = chunk.x_groq?.usage;

      if (usage) {
        promptTokens = usage.prompt_tokens;
        completionTokens = usage.completion_tokens;
        // totalTokens = usage.total_tokens;
      }
    }

    /**
     * Salto de línea para mejorar la
     * visualización en consola.
     */
    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens: promptTokens,
      totalOutputTokens: completionTokens,
      toolsUsed: [],
    };
  }

  /**
   * Ejecuta una conversación con Groq permitiendo que el modelo invoque
   * herramientas durante el proceso.
   *
   * El flujo se repite hasta que:
   *
   * - El modelo genera una respuesta final.
   * - Se alcanza el límite máximo de iteraciones.
   * - Groq retorna una respuesta sin texto ni llamadas a herramientas.
   */
  async askWithTools({
    prompt,
    systemPrompt,
    messages,
    tools,
  }: AgentRequest): Promise<AgentResponse> {
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

    /**
     * La conversación se construye una sola vez.
     *
     * Después se modifica durante cada iteración agregando:
     *
     * - el mensaje assistant con tool_calls;
     * - los resultados devueltos por cada herramienta.
     */
    const groqConversation = buildConversation({
      prompt,
      systemPrompt,
      messages,
    });

    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const response = await this.create(
        config.max_tokens,
        groqConversation,
        tools,
      );

      const choice = response.choices[0];
      const assistantMessage = choice?.message;
      totalInputTokens += response.usage?.prompt_tokens ?? 0;
      totalOutputTokens += response.usage?.completion_tokens ?? 0;

      // console.dir(
      //   {
      //     model: response.model,
      //     content: assistantMessage?.content,
      //     toolCalls: assistantMessage?.tool_calls,
      //     doneReason: choice?.finish_reason,
      //   },
      //   {
      //     depth: null,
      //   },
      // );

      if (!assistantMessage) {
        console.warn("Groq no retornó un mensaje en la respuesta.");

        return {
          text: "Groq no retornó un mensaje en la respuesta.",
          totalInputTokens,
          totalOutputTokens,
          toolsUsed: [...toolsUsed],
        };
      }

      const toolCalls =
        assistantMessage.tool_calls?.filter(
          (toolCall) => toolCall.type === "function",
        ) ?? [];

      /**
       * Si no hay llamadas a herramientas,
       * el contenido generado es la respuesta final.
       */
      if (toolCalls.length === 0) {
        const text = assistantMessage.content?.trim();

        if (!text) {
          console.warn("Groq no retornó texto ni llamadas a herramientas.");

          return {
            text: "Groq no retornó texto ni llamadas " + "a herramientas.",
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
       * Agrega el mensaje assistant con sus tool_calls
       * antes de agregar los resultados.
       *
       * Cada mensaje tool posterior debe apuntar al ID
       * definido en este mensaje.
       */
      groqConversation.push(responseToMessage(response));

      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const toolName = toolCall.function.name;

          const toolCallId = toolCall.id;

          if (!toolName) {
            return {
              id: toolCallId,
              name: "unknown_tool",
              output: JSON.stringify({
                success: false,
                error: "missing_tool_name",
                message: "Groq no indicó el nombre de la herramienta.",
              }),
            };
          }

          const currentTool = tools?.find((tool) => tool.name === toolName);

          if (!currentTool) {
            return {
              id: toolCallId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "tool_not_found",
                message:
                  `La herramienta "${toolName}" ` + "no está registrada.",
              }),
            };
          }

          const params = tryParseStringKeyedObject(toolCall.function.arguments);

          if (!params) {
            return {
              id: toolCallId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "invalid_arguments",
                message:
                  `Los argumentos de la herramienta ` +
                  `"${toolName}" no contienen ` +
                  "un objeto JSON válido.",
              }),
            };
          }

          const validation = validateRequiredArguments(currentTool, params);

          if (!validation.valid) {
            return {
              id: toolCallId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "missing_required_arguments",
                message:
                  `Faltan argumentos requeridos para ` + `"${toolName}".`,
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
              id: toolCallId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "duplicated_tool_call",
                message:
                  `La herramienta "${toolName}" ya fue ` +
                  "ejecutada con los mismos argumentos. " +
                  "Utiliza el resultado anterior para " +
                  "generar la respuesta final.",
              }),
            };
          }

          executedToolCalls.add(callSignature);

          console.log(
            `Ejecutando tool: ${toolName} ` + `(${JSON.stringify(params)})`,
          );

          let output: string;
          try {
            output = await executeFileTool(toolName, params);

            toolsUsed.add(toolName);

            if (!output?.trim()) {
              output = JSON.stringify({
                success: false,
                error: "empty_tool_result",
                message:
                  `La herramienta "${toolName}" ` + "no devolvió contenido.",
              });
            }
          } catch (error) {
            output = JSON.stringify({
              success: false,
              error: "tool_execution_failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Error desconocido ejecutando la herramienta.",
            });
          }

          console.log(`Herramienta completada: ${toolName}`);

          return {
            id: toolCallId,
            name: toolName,
            output,
          };
        }),
      );

      /**
       * Agrega los resultados de las herramientas.
       *
       * tool_call_id debe coincidir exactamente con el ID
       * generado en assistant.tool_calls.
       */
      for (const result of toolResults) {
        groqConversation.push({
          role: "tool",
          tool_call_id: result.id,
          content: result.output,
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
