import ollama, { Message as OllamaMessage } from "ollama";

import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
} from "../../../types/agent/index.js";

import { LlmClient } from "../../../types/app/client.js";
import { config } from "../../../config/index.js";
import {
  buildConversation,
  toAgentMessages,
  toOllamaTools,
} from "./internal/index.js";
import { tryGetStringKeyedObject } from "../../../utils/data/object.guards.js";
import { validateRequiredArguments } from "../../../utils/tools/tool.guards.js";
import { executeFileTool } from "../../../tools/executor/files-tools.executor.js";
import { ollamaSystemPrompt } from "./internal/systemprompt.config.js";

export class OllamaClient implements LlmClient {
  private async create(
    maxTokens: number,
    messages: OllamaMessage[],
    tools?: ToolDefinition[],
  ) {
    const response = await ollama.chat({
      model: config.ollamaModel,
      messages,
      tools: toOllamaTools(tools),
      think: false,
      stream: false,
      keep_alive: "10m",
      options: { temperature: 0, num_predict: maxTokens, num_ctx: 4096 },
    });

    return response;
  }

  private async createStream(maxTokens: number, messages: OllamaMessage[]) {
    const response = await ollama.chat({
      model: config.ollamaModel,
      messages,
      think: false,
      stream: true,
      keep_alive: "10m",
      options: { temperature: 0, num_predict: maxTokens, num_ctx: 4096 },
    });
    return response;
  }

  async ask({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    const nSystemPrompt = systemPrompt
      ? systemPrompt + "\n" + ollamaSystemPrompt
      : undefined;
    const conversation = buildConversation({
      prompt,
      systemPrompt: nSystemPrompt,
      messages,
    });

    const response = await this.create(config.max_tokens, conversation);

    const text = response.message.content?.trim();
    if (!text) {
      return {
        text: "Ollama no retornó contenido de texto en la respuesta.",
        totalInputTokens: response.prompt_eval_count ?? 0,
        totalOutputTokens: response.eval_count ?? 0,
        toolsUsed: [],
      };
    }

    return {
      text,
      totalInputTokens: response.prompt_eval_count ?? 0,
      totalOutputTokens: response.eval_count ?? 0,
      toolsUsed: [],
    };
  }

  async stream({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    const nSystemPrompt = systemPrompt
      ? systemPrompt + "\n" + ollamaSystemPrompt
      : undefined;
    const conversation = buildConversation({
      prompt,
      systemPrompt: nSystemPrompt,
      messages,
    });

    const stream = await this.createStream(config.max_tokens, conversation);

    let content = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for await (const chunk of stream) {
      if (chunk.message.content) {
        process.stdout.write(chunk.message.content);
        content += chunk.message.content;
      }

      if (chunk.done) {
        totalInputTokens = chunk.prompt_eval_count ?? totalInputTokens;

        totalOutputTokens = chunk.eval_count ?? totalOutputTokens;
      }
    }

    process.stdout.write("\n");

    return {
      text: content.trim(),
      totalInputTokens,
      totalOutputTokens,
      toolsUsed: [],
    };
  }

  async askWithTools({
    prompt,
    systemPrompt,
    messages,
    tools,
  }: AgentRequest): Promise<AgentResponse> {
    const nSystemPrompt = systemPrompt
      ? systemPrompt + "\n" + ollamaSystemPrompt
      : undefined;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const toolsUsed = new Set<string>();
    const executedToolCalls = new Set<string>();

    const conversation = buildConversation({
      prompt,
      systemPrompt: nSystemPrompt,
      messages,
    });

    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const response = await this.create(
        config.max_tokens_tools,
        conversation,
        tools,
      );

      totalInputTokens += response.prompt_eval_count ?? 0;
      totalOutputTokens += response.eval_count ?? 0;
      const assistantMessage = response.message;

      // console.dir(
      //   {
      //     model: response.model,
      //     content: assistantMessage?.content,
      //     toolCalls: assistantMessage?.tool_calls,
      //     doneReason: response.done_reason,
      //   },
      //   {
      //     depth: null,
      //   },
      // );

      if (!assistantMessage) {
        console.warn("Ollama no retornó un mensaje en la respuesta.");

        return {
          text: "Ollama no retornó un mensaje en la respuesta.",
          totalInputTokens,
          totalOutputTokens,
          toolsUsed: [...toolsUsed],
        };
      }

      const toolCalls = assistantMessage.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const text = assistantMessage.content?.trim();

        if (!text) {
          console.warn("Ollama no retornó texto ni llamadas a herramientas.");

          return {
            text: "Ollama no retornó texto ni llamadas " + "a herramientas.",
            totalInputTokens,
            totalOutputTokens,
            toolsUsed: [...toolsUsed],
          };
        }

        conversation.push(assistantMessage);

        console.log("Respuesta final generada\n");

        return {
          text,
          totalInputTokens,
          totalOutputTokens,
          toolsUsed: [...toolsUsed],
          conversation: toAgentMessages(conversation),
        };
      }

      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall, index) => {
          const toolName = toolCall.function.name;
          const toolCallId = `${iteration}-${index}-${toolName || "unknown"}`;

          if (!toolName) {
            return {
              id: toolCallId,
              name: "unknown_tool",
              output: JSON.stringify({
                success: false,
                error: "missing_tool_name",
                message: "Ollama no indicó el nombre de la herramienta.",
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

          const params = tryGetStringKeyedObject(toolCall.function.arguments);

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
              callId: toolCallId,
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

          const callSignature = JSON.stringify({
            name: toolName,
            arguments: params,
          });

          if (executedToolCalls.has(callSignature)) {
            console.warn(`Llamada duplicada detectada: ${toolName}`);

            return {
              callId: toolCallId,
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

          console.log(
            `Ejecutando tool: ${toolName} ` + `(${JSON.stringify(params)})`,
          );

          try {
            let output = await executeFileTool(toolName, params);

            executedToolCalls.add(callSignature);
            toolsUsed.add(toolName);

            if (!output?.trim()) {
              return {
                callId: toolCallId,
                name: toolName,
                output: JSON.stringify({
                  success: false,
                  error: "empty_tool_result",
                  message:
                    `La herramienta "${toolName}" ` + "no devolvió contenido.",
                }),
              };
            }

            console.log(`Herramienta completada: ${toolCall.function.name}`);
            return {
              callId: toolCallId,
              name: toolName,
              output,
            };
          } catch (error) {
            return {
              callId: toolCallId,
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

      for (const result of toolResults) {
        conversation.push({
          role: "tool",
          content: result?.output ?? "",
          tool_name: result?.name,
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
