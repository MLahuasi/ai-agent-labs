import Anthropic from "@anthropic-ai/sdk";

import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
} from "../../../../types/agent/index.js";

import { config } from "../../../../config/index.js";
import { LlmClient } from "../../../../types/app/index.js";

import {
  buildMessages,
  extractAnthropicToolCalls,
  getAnthropicResponseText,
  toAnthropicAssistantMessage,
  toAnthropicTools,
} from "./internal/index.js";

import { AnthropicToolExecutor } from "./anthropic-tool-executor.js";

import type { AnthropicToolCall, ExecutionContext } from "./anthropic.types.js";

/**
 * Cliente encargado de gestionar la comunicación con Anthropic.
 */
export class AnthropicClient implements LlmClient {
  // Cliente utilizado para realizar solicitudes a Anthropic.
  private readonly client: Anthropic;

  // Ejecutor de las herramientas solicitadas por el modelo.
  private readonly toolExecutor: AnthropicToolExecutor;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    this.toolExecutor = new AnthropicToolExecutor();
  }

  /**
   * Realiza una consulta completa mediante Messages API.
   *
   * @param systemPrompt Prompt del sistema.
   * @param maxTokens Máximo de tokens permitidos en la respuesta.
   * @param messages Historial de la conversación.
   * @param tools Herramientas opcionales disponibles.
   * @return Respuesta completa generada por Anthropic.
   */
  private async create(
    systemPrompt: string,
    maxTokens: number,
    messages: Anthropic.Messages.MessageParam[],
    tools?: ToolDefinition[],
  ) {
    return this.client.messages.create({
      model: config.anthropicModel,
      max_tokens: maxTokens,

      ...(systemPrompt && {
        system: systemPrompt,
      }),

      tools: toAnthropicTools(tools),
      messages,
    });
  }

  /**
   * Realiza una consulta mediante streaming.
   *
   * @param systemPrompt Prompt del sistema.
   * @param maxTokens Máximo de tokens permitidos en la respuesta.
   * @param messages Historial de la conversación.
   * @param tools Herramientas opcionales disponibles.
   * @return Stream generado por Anthropic.
   */
  private async createStream(
    systemPrompt: string,
    maxTokens: number,
    messages: Anthropic.Messages.MessageParam[],
    tools?: ToolDefinition[],
  ) {
    return this.client.messages.stream({
      model: config.anthropicModel,
      max_tokens: maxTokens,

      ...(systemPrompt && {
        system: systemPrompt,
      }),

      messages,
      tools: toAnthropicTools(tools),
    });
  }

  /**
   * Crea el contexto inicial para una conversación con herramientas.
   *
   * @param prompt Mensaje inicial enviado por el usuario.
   * @param messages Historial opcional de conversación.
   * @return Contexto inicial de ejecución.
   */
  private createExecutionContext(
    prompt: string,
    messages?: AgentRequest["messages"],
  ): ExecutionContext {
    return {
      messages: buildMessages(prompt, messages),
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
   * @param usage Consumo de tokens de la respuesta.
   * @return No retorna ningún valor.
   */
  private addUsage(
    context: ExecutionContext,
    usage: {
      input_tokens: number;
      output_tokens: number;
    },
  ): void {
    context.totalInputTokens += usage.input_tokens;

    context.totalOutputTokens += usage.output_tokens;
  }

  /**
   * Construye la respuesta del agente.
   *
   * @param text Texto generado por el modelo.
   * @param context Contexto actual de ejecución.
   * @return Respuesta del agente.
   */
  private buildResponse(
    text: string,
    context: ExecutionContext,
  ): AgentResponse {
    return {
      text,
      totalInputTokens: context.totalInputTokens,
      totalOutputTokens: context.totalOutputTokens,
      toolsUsed: [...context.toolState.toolsUsed],
    };
  }

  /**
   * Genera una respuesta completa y procesa las herramientas solicitadas.
   *
   * @param request Datos necesarios para generar la respuesta.
   * @param request.prompt Mensaje inicial enviado por el usuario.
   * @param request.systemPrompt Instrucciones opcionales.
   * @param request.messages Historial opcional de conversación.
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
      const response = await this.create(
        systemPrompt ?? "",
        config.max_tokens,
        buildMessages(prompt, messages),
      );

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

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext(prompt, messages);

    // Ejecuta iteraciones hasta obtener una respuesta final o alcanzar el límite.
    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      // Envía el historial acumulado al modelo.
      const response = await this.create(
        systemPrompt ?? "",
        config.max_tokens_tools,
        context.messages,
        tools,
      );

      this.addUsage(context, response.usage);

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls: AnthropicToolCall[] = extractAnthropicToolCalls(
        response.content,
      ).map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      }));

      const content = getAnthropicResponseText(response.content);

      // Retorna el contenido cuando el modelo finaliza la respuesta.
      if (response.stop_reason === "end_turn") {
        if (!content) {
          return this.buildResponse(
            "Anthropic no retornó contenido de texto en la respuesta.",
            context,
          );
        }

        console.log("Respuesta final generada\n");

        return this.buildResponse(content, context);
      }

      // Procesa las herramientas cuando el modelo solicita su ejecución.
      if (response.stop_reason === "tool_use") {
        if (!toolCalls.length) {
          return this.buildResponse(
            "Anthropic indicó tool_use, pero no retornó " +
              "ninguna llamada a herramientas.",
            context,
          );
        }

        // Agrega el mensaje del modelo al historial de la conversación.
        context.messages.push(toAnthropicAssistantMessage(response.content));

        // Ejecuta las herramientas solicitadas por el modelo.
        const results = await this.toolExecutor.execute(
          toolCalls,
          tools,
          context.toolState,
        );

        // Agrega los resultados para la siguiente iteración.
        this.toolExecutor.appendResults(context.messages, results);

        continue;
      }

      // Retorna el contenido disponible cuando la ejecución finaliza por otra razón.
      console.warn(
        `Stop reason inesperado: ` + `${response.stop_reason ?? "desconocido"}`,
      );

      return this.buildResponse(
        content ||
          `Sesión terminada: ` +
            `${response.stop_reason ?? "razón desconocida"}`,
        context,
      );
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
   * @param request.systemPrompt Instrucciones opcionales.
   * @param request.messages Historial opcional de conversación.
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
      let fullResponse = "";

      const stream = await this.createStream(
        systemPrompt ?? "",
        config.max_tokens,
        buildMessages(prompt, messages),
      );

      // Acumula cada fragmento de texto recibido.
      stream.on("text", (chunk) => {
        process.stdout.write(chunk);

        fullResponse += chunk;
      });

      const finalMessage = await stream.finalMessage();

      process.stdout.write("\n");

      return {
        text: fullResponse,
        totalInputTokens: finalMessage.usage.input_tokens,
        totalOutputTokens: finalMessage.usage.output_tokens,
        toolsUsed: [],
      };
    }

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext(prompt, messages);

    // Ejecuta una nueva generación en streaming por cada iteración.
    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      // Acumula el texto generado durante la iteración actual.
      let streamedText = "";

      const stream = await this.createStream(
        systemPrompt ?? "",
        config.max_tokens_tools,
        context.messages,
        tools,
      );

      stream.on("text", (chunk) => {
        process.stdout.write(chunk);

        streamedText += chunk;
      });

      // Obtiene la respuesta completa de la iteración.
      const response = await stream.finalMessage();

      this.addUsage(context, response.usage);

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls: AnthropicToolCall[] = extractAnthropicToolCalls(
        response.content,
      ).map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      }));

      const content = getAnthropicResponseText(response.content);

      // Retorna el contenido cuando el modelo finaliza la respuesta.
      if (response.stop_reason === "end_turn") {
        const text = streamedText.trim() || content?.trim();

        process.stdout.write("\n");

        if (!text) {
          return this.buildResponse(
            "Anthropic no retornó contenido de texto en la respuesta.",
            context,
          );
        }

        console.log("Respuesta final generada\n");

        return this.buildResponse(text, context);
      }

      // Procesa las herramientas cuando el modelo solicita su ejecución.
      if (response.stop_reason === "tool_use") {
        if (!toolCalls.length) {
          return this.buildResponse(
            "Anthropic indicó tool_use, pero no retornó " +
              "ninguna llamada a herramientas.",
            context,
          );
        }

        // Agrega el mensaje del modelo al historial de la conversación.
        context.messages.push(toAnthropicAssistantMessage(response.content));

        // Ejecuta las herramientas solicitadas por el modelo.
        const results = await this.toolExecutor.execute(
          toolCalls,
          tools,
          context.toolState,
        );

        // Agrega los resultados para la siguiente iteración.
        this.toolExecutor.appendResults(context.messages, results);

        continue;
      }

      // Retorna el contenido disponible cuando la ejecución finaliza por otra razón.
      console.warn(
        `Stop reason inesperado: ` + `${response.stop_reason ?? "desconocido"}`,
      );

      return this.buildResponse(
        content ||
          streamedText ||
          `Sesión terminada: ` +
            `${response.stop_reason ?? "razón desconocida"}`,
        context,
      );
    }

    console.warn(`Límite de ${config.max_iterations} iteraciones alcanzado`);

    return this.buildResponse(
      `Lo siento, no pude completar la tarea en ` +
        `${config.max_iterations} iteraciones. ` +
        "Intenta una pregunta más específica.",
      context,
    );
  }
}
