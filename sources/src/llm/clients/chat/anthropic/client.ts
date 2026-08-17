import Anthropic from "@anthropic-ai/sdk";

import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

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

  // Modelo utilizado para generar las respuestas.
  private readonly model: string;

  /**
   * Crea una nueva instancia del cliente de Anthropic.
   *
   * @param params Configuración necesaria para inicializar el cliente.
   * @param params.apiKey Clave de API utilizada para autenticar las solicitudes.
   * @param params.model Modelo de Anthropic utilizado para generar respuestas.
   */
  constructor({ apiKey, model }: { apiKey: string; model: string }) {
    this.client = new Anthropic({
      apiKey,
    });
    this.model = model;
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
      model: this.model,
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
      model: this.model,
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
   * @param toolState Estado de ejecución de herramientas del turno actual.
   * @return Contexto inicial de ejecución.
   */
  private createExecutionContext(
    prompt: string,
    messages: AgentRequest["messages"],
    toolState: ToolExecutionState,
  ): ExecutionContext {
    return {
      messages: buildMessages(prompt, messages),
      totalInputTokens: 0,
      totalOutputTokens: 0,
      toolState,
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
      toolCallsLastTurn: context.toolState.toolCallsLastTurn,
    };
  }

  /**
   * Genera una respuesta completa y procesa las herramientas solicitadas.
   *
   * @param request Datos necesarios para generar la respuesta.
   * @param request.prompt Mensaje inicial enviado por el usuario.
   * @param request.systemPrompt Instrucciones opcionales del sistema.
   * @param request.messages Historial opcional de conversación.
   * @param request.tools Herramientas opcionales disponibles para el modelo.
   * @param request.executeTool Función opcional utilizada para ejecutar herramientas.
   * @param request.toolState Estado opcional de ejecución de herramientas del turno actual.
   * @param request.maxIterations Máximo de iteraciones permitidas durante una ejecución con herramientas.
   * @param request.maxTokens Máximo de tokens permitidos en una respuesta sin herramientas.
   * @param request.maxTokensTools Máximo de tokens permitidos durante una ejecución con herramientas.
   * @return Respuesta generada por el modelo.
   */
  async ask({
    prompt,
    systemPrompt,
    messages,
    tools,
    executeTool,
    toolState,
    maxIterations,
    maxTokens,
    maxTokensTools,
  }: AgentRequest): Promise<AgentResponse> {
    // Ejecuta una única consulta cuando no existen herramientas.
    if (!tools?.length) {
      const response = await this.create(
        systemPrompt ?? "",
        maxTokens,
        buildMessages(prompt, messages),
      );

      const text = getAnthropicResponseText(response.content);

      return {
        text: text || "Anthropic no retornó contenido de texto en la respuesta",
        totalInputTokens: response.usage.input_tokens ?? 0,
        totalOutputTokens: response.usage.output_tokens ?? 0,
        toolsUsed: [],
        toolCallsLastTurn: 0,
      };
    }

    if (!executeTool) {
      throw new Error(
        "Se proporcionaron tools pero no un ejecutor de herramientas.",
      );
    }

    if (!toolState) {
      throw new Error(
        "Se proporcionaron tools pero no un estado de ejecución.",
      );
    }

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext(prompt, messages, toolState);

    // Ejecuta iteraciones hasta obtener una respuesta final o alcanzar el límite.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      // Envía el historial acumulado al modelo.
      const response = await this.create(
        systemPrompt ?? "",
        maxTokensTools,
        context.messages,
        availableTools,
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
          executeTool,
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

    console.warn(`Límite de ${maxIterations} iteraciones alcanzado`);

    return this.buildResponse(
      `Lo siento, no pude completar la tarea en ` +
        `${maxIterations} iteraciones. ` +
        "Intenta una pregunta más específica.",
      context,
    );
  }

  /**
   * Genera una respuesta mediante streaming y procesa las herramientas solicitadas.
   *
   * @param request Datos necesarios para generar la respuesta.
   * @param request.prompt Mensaje inicial enviado por el usuario.
   * @param request.systemPrompt Instrucciones opcionales del sistema.
   * @param request.messages Historial opcional de conversación.
   * @param request.tools Herramientas opcionales disponibles para el modelo.
   * @param request.executeTool Función opcional utilizada para ejecutar herramientas.
   * @param request.toolState Estado opcional de ejecución de herramientas del turno actual.
   * @param request.maxTokens Máximo de tokens permitidos en una respuesta sin herramientas.
   * @param request.maxIterations Máximo de iteraciones permitidas durante una ejecución con herramientas.
   * @param request.maxTokensTools Máximo de tokens permitidos durante una ejecución con herramientas.
   * @return Respuesta generada por el modelo.
   */
  async stream({
    prompt,
    systemPrompt,
    messages,
    tools,
    executeTool,
    toolState,
    maxTokens,
    maxIterations,
    maxTokensTools,
  }: AgentRequest): Promise<AgentResponse> {
    // Ejecuta un único stream cuando no existen herramientas.
    if (!tools?.length) {
      let fullResponse = "";

      const stream = await this.createStream(
        systemPrompt ?? "",
        maxTokens,
        buildMessages(prompt, messages),
      );

      // Acumula cada fragmento de texto recibido.
      stream.on("text", (chunk) => {
        fullResponse += chunk;
      });

      const finalMessage = await stream.finalMessage();

      const finalText = getAnthropicResponseText(finalMessage.content);

      const text =
        fullResponse.trim() ||
        finalText?.trim() ||
        "Anthropic no retornó contenido de texto en la respuesta";

      return {
        text,
        totalInputTokens: finalMessage.usage.input_tokens,
        totalOutputTokens: finalMessage.usage.output_tokens,
        toolsUsed: [],
        toolCallsLastTurn: 0,
      };
    }

    if (!executeTool) {
      throw new Error(
        "Se proporcionaron tools pero no un ejecutor de herramientas.",
      );
    }

    if (!toolState) {
      throw new Error(
        "Se proporcionaron tools pero no un estado de ejecución.",
      );
    }

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext(prompt, messages, toolState);

    // Ejecuta una nueva generación en streaming por cada iteración.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      // Acumula el texto generado durante la iteración actual.
      let streamedText = "";

      const stream = await this.createStream(
        systemPrompt ?? "",
        maxTokensTools,
        context.messages,
        availableTools,
      );

      stream.on("text", (chunk) => {
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
          executeTool,
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

    console.warn(`Límite de ${maxIterations} iteraciones alcanzado`);

    return this.buildResponse(
      `Lo siento, no pude completar la tarea en ` +
        `${maxIterations} iteraciones. ` +
        "Intenta una pregunta más específica.",
      context,
    );
  }
}
