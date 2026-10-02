import { GoogleGenAI, type Content } from "@google/genai";
import { LlmClient } from "../../../../types/app/index.js";

import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

import { buildContents, toGeminiTools } from "./internal/index.js";

import { GeminiToolExecutor } from "./gemini-tool-executor.js";

import { ExecutionContext, GeminiToolCall } from "./gemini.types.js";
import {
  LlmUsageLimiterService,
  LlmUsageTrackerService,
} from "../../../../cost/index.js";

/**
 * Cliente encargado de gestionar la comunicación con Gemini.
 */
export class GeminiClient implements LlmClient {
  // Cliente utilizado para realizar solicitudes a Gemini.
  private readonly client: GoogleGenAI;

  // Ejecutor de las herramientas solicitadas por el modelo.
  private readonly toolExecutor: GeminiToolExecutor;

  // Modelo utilizado para generar las respuestas.
  private readonly model: string;

  /** Controla y limita la cantidad de llamadas realizadas a los proveedores LLM. */
  private readonly usageLimiter: LlmUsageLimiterService;

  /** Registra y acumula el consumo real de tokens generado por las llamadas al LLM. */
  private readonly usageTracker: LlmUsageTrackerService;

  /**
   * Crea una nueva instancia del cliente de Gemini.
   *
   * @param params Configuración necesaria para inicializar el cliente.
   * @param params.apiKey Clave de API utilizada para autenticar las solicitudes.
   * @param params.model Modelo de Gemini utilizado para generar respuestas.
   */
  constructor({
    apiKey,
    model,
    usageLimiter,
    usageTracker,
  }: {
    apiKey: string;
    model: string;
    usageLimiter: LlmUsageLimiterService;
    usageTracker: LlmUsageTrackerService;
  }) {
    this.client = new GoogleGenAI({
      apiKey,
    });

    this.model = model;
    this.usageLimiter = usageLimiter;
    this.usageTracker = usageTracker;
    this.toolExecutor = new GeminiToolExecutor();
  }

  /**
   * Registra el consumo acumulado de una ejecución.
   */
  private recordUsage(
    requests: number,
    inputTokens: number,
    outputTokens: number,
  ): void {
    this.usageTracker.record({
      provider: "gemini",
      model: this.model,
      requests,
      inputTokens,
      outputTokens,
    });
  }

  /**
   * Realiza una consulta completa mediante Gemini.
   *
   * @param contents Historial enviado a Gemini.
   * @param maxTokens Máximo de tokens permitidos.
   * @param systemPrompt Instrucciones opcionales para el modelo.
   * @param tools Herramientas opcionales disponibles.
   * @return Respuesta completa generada por Gemini.
   */
  private async create(
    contents: Content[],
    maxTokens: number,
    systemPrompt?: string,
    tools?: ToolDefinition[],
  ) {
    return this.client.models.generateContent({
      model: this.model,
      contents,

      config: {
        maxOutputTokens: maxTokens,

        ...(systemPrompt && {
          systemInstruction: systemPrompt,
        }),

        ...(tools?.length && {
          tools: toGeminiTools(tools),
        }),
      },
    });
  }

  /**
   * Realiza una consulta mediante streaming.
   *
   * @param contents Historial enviado a Gemini.
   * @param maxTokens Máximo de tokens permitidos.
   * @param systemPrompt Instrucciones opcionales para el modelo.
   * @param tools Herramientas opcionales disponibles.
   * @return Stream generado por Gemini.
   */
  private async createStream(
    contents: Content[],
    maxTokens: number,
    systemPrompt?: string,
    tools?: ToolDefinition[],
  ) {
    return this.client.models.generateContentStream({
      model: this.model,
      contents,

      config: {
        maxOutputTokens: maxTokens,

        ...(systemPrompt && {
          systemInstruction: systemPrompt,
        }),

        ...(tools?.length && {
          tools: toGeminiTools(tools),
        }),
      },
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
      contents: buildContents({
        prompt,
        messages,
      }),
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
    usage:
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        }
      | undefined,
  ): void {
    context.totalInputTokens += usage?.promptTokenCount ?? 0;

    context.totalOutputTokens += usage?.candidatesTokenCount ?? 0;
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
    // Registra toda la ejecución, incluidas las iteraciones con tools.
    this.recordUsage(1, context.totalInputTokens, context.totalOutputTokens);

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
   * @param request.systemPrompt Instrucciones opcionales para el modelo.
   * @param request.messages Historial opcional de la conversación.
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
      // Una consulta directa consume una request.
      this.usageLimiter.consume();
      const response = await this.create(
        buildContents({
          prompt,
          messages,
        }),
        maxTokens,
        systemPrompt,
      );

      const text = response.text;

      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

      this.recordUsage(1, inputTokens, outputTokens);

      return {
        text: text || "Gemini no retornó contenido de texto en la respuesta",
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
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
    /**
     * Consumir una solicitud inmediatamente antes
     * de realizar la llamada real al proveedor.
     */
    this.usageLimiter.consume();

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext(prompt, messages, toolState);

    // Ejecuta iteraciones hasta obtener una respuesta final o alcanzar el límite.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      const response = await this.create(
        context.contents,
        maxTokensTools,
        systemPrompt,
        availableTools,
      );

      this.addUsage(context, response.usageMetadata);

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls: GeminiToolCall[] = (response.functionCalls ?? []).map(
        (toolCall) => ({
          id: toolCall.id,
          name: toolCall.name,
          args: toolCall.args,
        }),
      );

      // Retorna el contenido generado cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = response.text?.trim();

        if (!text) {
          console.warn("Gemini no retornó texto ni llamadas a herramientas.");

          return this.buildResponse(
            "Gemini no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        console.log("Respuesta final generada\n");

        return this.buildResponse(text, context);
      }

      // Obtiene el contenido generado para continuar la conversación.
      const content = response.candidates?.[0]?.content;

      if (!content) {
        console.warn("Gemini no retornó un content.");

        return this.buildResponse("Gemini no retornó un content.", context);
      }

      // Agrega la salida del modelo al historial de la conversación.
      context.contents.push(content);

      // Ejecuta las herramientas solicitadas por el modelo.
      const results = await this.toolExecutor.execute(
        toolCalls,
        tools,
        context.toolState,
        executeTool,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.contents, results);
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
   * @param request.systemPrompt Instrucciones opcionales para el modelo.
   * @param request.messages Historial opcional de la conversación.
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
    onChunk,
  }: AgentRequest): Promise<AgentResponse> {
    // Ejecuta un único stream cuando no existen herramientas.
    if (!tools?.length) {
      let fullResponse = "";
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // Una consulta directa consume una request.
      this.usageLimiter.consume();
      const stream = await this.createStream(
        buildContents({
          prompt,
          messages,
        }),
        maxTokens,
        systemPrompt,
      );

      // Procesa cada fragmento generado durante el stream.
      for await (const chunk of stream) {
        const text = chunk.text ?? "";

        if (text) {
          fullResponse += text;

          // Expone el fragmento al consumidor.
          onChunk?.(text);
        }

        // Actualiza el consumo de tokens disponible en el fragmento.
        totalInputTokens =
          chunk.usageMetadata?.promptTokenCount ?? totalInputTokens;

        totalOutputTokens =
          chunk.usageMetadata?.candidatesTokenCount ?? totalOutputTokens;
      }

      const text =
        fullResponse.trim() ||
        "Gemini no retornó contenido de texto en la respuesta";

      // Registra el consumo correspondiente a la única llamada realizada.
      this.recordUsage(1, totalInputTokens, totalOutputTokens);

      return {
        text,
        totalInputTokens,
        totalOutputTokens,
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
    /**
     * Consumir una solicitud inmediatamente antes
     * de realizar la llamada real al proveedor.
     */
    this.usageLimiter.consume();

    // Inicializa el contexto compartido entre las iteraciones.
    const context = this.createExecutionContext(prompt, messages, toolState);

    // Ejecuta una nueva generación en streaming por cada iteración.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      let streamedText = "";

      // Acumula las llamadas a herramientas de la iteración.
      const toolCalls: GeminiToolCall[] = [];

      // Acumula las partes generadas por el modelo.
      const modelParts: NonNullable<Content["parts"]> = [];

      let modelRole: string | undefined;

      let inputTokens = 0;
      let outputTokens = 0;

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      const stream = await this.createStream(
        context.contents,
        maxTokensTools,
        systemPrompt,
        availableTools,
      );

      // Procesa los fragmentos generados durante la iteración.
      for await (const chunk of stream) {
        const text = chunk.text ?? "";

        if (text) {
          streamedText += text;
          // Expone el fragmento generado durante la iteración.
          onChunk?.(text);
        }

        // Conserva las partes generadas para continuar la conversación.
        const content = chunk.candidates?.[0]?.content;

        if (content) {
          modelRole = content.role ?? modelRole;

          if (content.parts?.length) {
            modelParts.push(...content.parts);
          }
        }

        // Acumula las llamadas a herramientas encontradas.
        for (const toolCall of chunk.functionCalls ?? []) {
          const exists = toolCalls.some(
            (current) => current.id === toolCall.id,
          );

          if (!exists)
            toolCalls.push({
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.args,
            });
        }

        // Actualiza el consumo de tokens disponible en el fragmento.
        inputTokens = chunk.usageMetadata?.promptTokenCount ?? inputTokens;

        outputTokens =
          chunk.usageMetadata?.candidatesTokenCount ?? outputTokens;
      }

      context.totalInputTokens += inputTokens;
      context.totalOutputTokens += outputTokens;

      // Retorna el texto cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = streamedText.trim();

        if (!text) {
          console.warn("Gemini no retornó texto ni llamadas a herramientas.");

          return this.buildResponse(
            "Gemini no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        console.log("Respuesta final generada\n");

        return this.buildResponse(text, context);
      }

      // Valida que exista contenido para continuar la conversación.
      if (!modelParts.length) {
        console.warn("Gemini no retornó un content.");

        return this.buildResponse("Gemini no retornó un content.", context);
      }

      // Agrega la salida del modelo al historial de la conversación.
      context.contents.push({
        role: modelRole ?? "model",
        parts: modelParts,
      });

      // Ejecuta las herramientas solicitadas por el modelo.
      const results = await this.toolExecutor.execute(
        toolCalls,
        tools,
        context.toolState,
        executeTool,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.contents, results);
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
