import ollama, { Message as OllamaMessage } from "ollama";
import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
} from "../../../../types/agent/index.js";
import { LlmClient } from "../../../../types/app/client.js";
import { config } from "../../../../config/index.js";
import {
  buildConversation,
  toAgentMessages,
  toOllamaTools,
} from "./internal/index.js";
import { ollamaSystemPrompt } from "./internal/systemprompt.config.js";
import { OllamaToolExecutor } from "./ollama-tool-executor.js";

import type {
  ExecutionContext,
  OllamaToolCall,
  StreamIterationResult,
} from "./ollama.types.js";

/**
 * Cliente encargado de gestionar la comunicación con Ollama.
 */
export class OllamaClient implements LlmClient {
  // Ejecutor de las herramientas solicitadas por el modelo.
  private readonly toolExecutor: OllamaToolExecutor;

  constructor() {
    this.toolExecutor = new OllamaToolExecutor();
  }

  /**
   * Realiza una consulta completa mediante Ollama.
   *
   * @param maxTokens Máximo de tokens permitidos.
   * @param messages Historial enviado a Ollama.
   * @param tools Herramientas opcionales disponibles.
   * @return Respuesta completa generada por Ollama.
   */
  private async create(
    maxTokens: number,
    messages: OllamaMessage[],
    tools?: ToolDefinition[],
  ) {
    return ollama.chat({
      model: config.ollamaModel,
      messages,
      tools: toOllamaTools(tools),
      think: false,
      stream: false,
      keep_alive: "10m",
      options: {
        temperature: 0,
        num_predict: maxTokens,
        num_ctx: 4096,
      },
    });
  }

  /**
   * Realiza una consulta mediante streaming.
   *
   * @param maxTokens Máximo de tokens permitidos.
   * @param messages Historial enviado a Ollama.
   * @param tools Herramientas opcionales disponibles.
   * @return Stream generado por Ollama.
   */
  private async createStream(
    maxTokens: number,
    messages: OllamaMessage[],
    tools?: ToolDefinition[],
  ) {
    return ollama.chat({
      model: config.ollamaModel,
      messages,
      tools: toOllamaTools(tools),
      think: false,
      stream: true,
      keep_alive: "10m",
      options: {
        temperature: 0,
        num_predict: maxTokens,
        num_ctx: 4096,
      },
    });
  }

  /**
   * Construye el system prompt utilizado por Ollama.
   *
   * @param systemPrompt System prompt opcional.
   * @return System prompt utilizado en la conversación.
   */
  private buildSystemPrompt(systemPrompt?: string): string | undefined {
    return systemPrompt ? systemPrompt + "\n" + ollamaSystemPrompt : undefined;
  }

  /**
   * Crea el contexto inicial para una conversación con herramientas.
   *
   * @param request Datos necesarios para construir la conversación.
   * @return Contexto inicial de ejecución.
   */
  private createExecutionContext({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): ExecutionContext {
    return {
      conversation: buildConversation({
        prompt,
        systemPrompt: this.buildSystemPrompt(systemPrompt),
        messages,
      }),
      totalInputTokens: 0,
      totalOutputTokens: 0,
      toolState: {
        toolsUsed: new Set<string>(),
        executedToolCalls: new Set<string>(),
      },
    };
  }

  /**
   * Acumula el consumo de tokens en el contexto.
   *
   * @param context Contexto actual de ejecución.
   * @param inputTokens Tokens de entrada.
   * @param outputTokens Tokens de salida.
   * @return No retorna ningún valor.
   */
  private addUsage(
    context: ExecutionContext,
    inputTokens?: number,
    outputTokens?: number,
  ): void {
    context.totalInputTokens += inputTokens ?? 0;

    context.totalOutputTokens += outputTokens ?? 0;
  }

  /**
   * Construye la respuesta del agente.
   *
   * @param text Texto generado por el modelo.
   * @param context Contexto actual de ejecución.
   * @param includeConversation Indica si se incluye el historial final.
   * @return Respuesta del agente.
   */
  private buildResponse(
    text: string,
    context: ExecutionContext,
    includeConversation = false,
  ): AgentResponse {
    return {
      text,
      totalInputTokens: context.totalInputTokens,
      totalOutputTokens: context.totalOutputTokens,
      toolsUsed: [...context.toolState.toolsUsed],

      ...(includeConversation && {
        conversation: toAgentMessages(context.conversation),
      }),
    };
  }

  /**
   * Genera una respuesta completa y procesa las herramientas solicitadas.
   *
   * @param request Datos necesarios para generar la respuesta.
   * @param request.prompt Mensaje inicial enviado por el usuario.
   * @param request.systemPrompt Instrucciones opcionales para el modelo.
   * @param request.messages Historial opcional de la conversación.
   * @param request.tools Herramientas opcionales disponibles.
   * @return Respuesta generada por el modelo.
   */
  async ask({
    prompt,
    systemPrompt,
    messages,
    tools,
  }: AgentRequest): Promise<AgentResponse> {
    // Ejecuta una única consulta cuando no existen herramientas.
    if (!tools?.length) {
      const conversation = buildConversation({
        prompt,
        systemPrompt: this.buildSystemPrompt(systemPrompt),
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

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext({
      prompt,
      systemPrompt,
      messages,
      tools,
    });

    // Ejecuta iteraciones hasta obtener una respuesta final o alcanzar el límite.
    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const response = await this.create(
        config.max_tokens_tools,
        context.conversation,
        tools,
      );

      this.addUsage(context, response.prompt_eval_count, response.eval_count);

      const assistantMessage = response.message;

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls: OllamaToolCall[] = assistantMessage.tool_calls ?? [];

      // Retorna el contenido generado cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = assistantMessage.content?.trim();

        if (!text) {
          console.warn("Ollama no retornó texto ni llamadas a herramientas.");

          return this.buildResponse(
            "Ollama no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        // Agrega el mensaje final al historial de la conversación.
        context.conversation.push(assistantMessage);

        console.log("Respuesta final generada\n");

        return this.buildResponse(text, context, true);
      }

      // Agrega la salida del modelo al historial de la conversación.
      context.conversation.push(assistantMessage);

      // Ejecuta las herramientas solicitadas por el modelo.
      const results = await this.toolExecutor.execute(
        toolCalls,
        tools,
        context.toolState,
        iteration,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.conversation, results);
    }

    console.warn(`Límite de ${config.max_iterations} iteraciones alcanzado`);

    return this.buildResponse(
      `Lo siento, no pude completar la tarea en ` +
        `${config.max_iterations} iteraciones. ` +
        "Intenta una pregunta más específica.",
      context,
    );
  }

  /**
   * Genera una respuesta mediante streaming y procesa las herramientas solicitadas.
   *
   * @param request Datos necesarios para generar la respuesta.
   * @param request.prompt Mensaje inicial enviado por el usuario.
   * @param request.systemPrompt Instrucciones opcionales para el modelo.
   * @param request.messages Historial opcional de la conversación.
   * @param request.tools Herramientas opcionales disponibles.
   * @return Respuesta generada por el modelo.
   */
  async stream({
    prompt,
    systemPrompt,
    messages,
    tools,
  }: AgentRequest): Promise<AgentResponse> {
    // Ejecuta un único stream cuando no existen herramientas.
    if (!tools?.length) {
      const conversation = buildConversation({
        prompt,
        systemPrompt: this.buildSystemPrompt(systemPrompt),
        messages,
      });

      const stream = await this.createStream(config.max_tokens, conversation);

      let content = "";
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // Procesa los fragmentos generados durante el stream.
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

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext({
      prompt,
      systemPrompt,
      messages,
      tools,
    });

    // Ejecuta una nueva generación en streaming por cada iteración.
    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const result = await this.executeStreamIteration(
        context.conversation,
        tools,
      );

      this.addUsage(context, result.inputTokens, result.outputTokens);

      // Retorna el contenido cuando no existen llamadas a herramientas.
      if (result.toolCalls.length === 0) {
        const text = result.text.trim();

        process.stdout.write("\n");

        if (!text) {
          console.warn("Ollama no retornó texto ni llamadas a herramientas.");

          return this.buildResponse(
            "Ollama no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        // Agrega el mensaje final al historial de la conversación.
        context.conversation.push(result.assistantMessage);

        console.log("Respuesta final generada\n");

        return this.buildResponse(text, context, true);
      }

      // Agrega la salida del modelo al historial de la conversación.
      context.conversation.push(result.assistantMessage);

      // Ejecuta las herramientas solicitadas por el modelo.
      const toolResults = await this.toolExecutor.execute(
        result.toolCalls,
        tools,
        context.toolState,
        iteration,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.conversation, toolResults);
    }

    console.warn(`Límite de ${config.max_iterations} iteraciones alcanzado`);

    return this.buildResponse(
      `Lo siento, no pude completar la tarea en ` +
        `${config.max_iterations} iteraciones. ` +
        "Intenta una pregunta más específica.",
      context,
    );
  }

  /**
   * Ejecuta una iteración completa mediante streaming.
   *
   * @param conversation Historial actual.
   * @param tools Herramientas disponibles.
   * @return Resultado completo de la iteración.
   */
  private async executeStreamIteration(
    conversation: OllamaMessage[],
    tools: ToolDefinition[],
  ): Promise<StreamIterationResult> {
    const stream = await this.createStream(
      config.max_tokens_tools,
      conversation,
      tools,
    );

    let text = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const toolCalls: OllamaToolCall[] = [];

    // Reconstruye el mensaje generado durante el streaming.
    const assistantMessage: OllamaMessage = {
      role: "assistant",
      content: "",
      tool_calls: [],
    };

    for await (const chunk of stream) {
      const content = chunk.message.content ?? "";

      if (content) {
        process.stdout.write(content);

        text += content;

        assistantMessage.content += content;
      }

      // Acumula las llamadas a herramientas encontradas.
      if (chunk.message.tool_calls?.length) {
        toolCalls.push(...chunk.message.tool_calls);

        assistantMessage.tool_calls?.push(...chunk.message.tool_calls);
      }

      // Actualiza el consumo de tokens al finalizar el stream.
      if (chunk.done) {
        totalInputTokens = chunk.prompt_eval_count ?? totalInputTokens;

        totalOutputTokens = chunk.eval_count ?? totalOutputTokens;
      }
    }

    return {
      text,
      assistantMessage,
      toolCalls,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }
}
