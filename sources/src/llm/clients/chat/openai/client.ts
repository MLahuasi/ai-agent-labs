import OpenAI from "openai";

import { LlmClient } from "../../../../types/app/index.js";

import {
  AgentRequest,
  AgentResponse,
  Message,
  ToolDefinition,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems.js";
import {
  buildInput,
  normalizeResponseOutput,
  toOpenAITools,
} from "./internal/index.js";
import { OpenAiToolExecutor } from "./openai-tool-executor.js";
import { ExecutionContext, OpenAiToolCall } from "./openai.types.js";
import {
  LlmUsageLimiterService,
  LlmUsageTrackerService,
} from "../../../../cost/index.js";

/**
 * Cliente encargado de gestionar la comunicación con OpenAI.
 */
export class OpenAiClient implements LlmClient {
  // Cliente utilizado para realizar solicitudes a OpenAI.
  private readonly client: OpenAI;

  // Ejecutor de las herramientas solicitadas por el modelo.
  private readonly toolExecutor: OpenAiToolExecutor;

  // Modelo utilizado para generar las respuestas.
  private readonly model: string;

  /** Controla y limita la cantidad de llamadas realizadas a los proveedores LLM. */
  private readonly usageLimiter: LlmUsageLimiterService;

  /** Registra y acumula el consumo real de tokens generado por las llamadas al LLM. */
  private readonly usageTracker: LlmUsageTrackerService;

  /**
   * Crea una nueva instancia del cliente de OpenAI.
   *
   * @param params Configuración necesaria para inicializar el cliente.
   * @param params.apiKey Clave de API utilizada para autenticar las solicitudes.
   * @param params.model Modelo de OpenAI utilizado para generar respuestas.
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
    this.client = new OpenAI({
      apiKey,
    });
    this.model = model;
    this.usageLimiter = usageLimiter;
    this.usageTracker = usageTracker;
    this.toolExecutor = new OpenAiToolExecutor();
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
      provider: "openai",
      model: this.model,
      requests,
      inputTokens,
      outputTokens,
    });
  }

  /**
   * Realiza una consulta completa mediante Responses API.
   *
   * @param input Prompt o historial enviado al modelo.
   * @param maxTokens Máximo de tokens permitidos en la respuesta.
   * @param systemPrompt Instrucciones opcionales para el modelo.
   * @param messages Historial opcional de conversación.
   * @param tools Herramientas opcionales disponibles para el modelo.
   * @return Respuesta completa generada por OpenAI.
   */
  private async create(
    input: string | OpenAI.Responses.ResponseInput,
    maxTokens: number,
    systemPrompt?: string,
    messages?: Message[],
    tools?: ToolDefinition[],
  ) {
    return this.client.responses.create({
      model: this.model,

      ...(systemPrompt && {
        instructions: systemPrompt,
      }),

      input:
        typeof input === "string"
          ? buildInput({
              prompt: input,
              messages,
            })
          : input,

      max_output_tokens: maxTokens,

      tools: toOpenAITools(tools),
    });
  }

  /**
   * Realiza una consulta mediante streaming.
   *
   * @param input Prompt o historial enviado al modelo.
   * @param maxTokens Máximo de tokens permitidos en la respuesta.
   * @param systemPrompt Instrucciones opcionales para el modelo.
   * @param messages Historial opcional de conversación.
   * @param tools Herramientas opcionales disponibles para el modelo.
   * @return Stream generado por OpenAI.
   */
  private async createStream(
    input: string | OpenAI.Responses.ResponseInput,
    maxTokens: number,
    systemPrompt?: string,
    messages?: Message[],
    tools?: ToolDefinition[],
  ) {
    return this.client.responses.stream({
      model: this.model,

      ...(systemPrompt && {
        instructions: systemPrompt,
      }),

      input:
        typeof input === "string"
          ? buildInput({
              prompt: input,
              messages,
            })
          : input,

      max_output_tokens: maxTokens,

      tools: toOpenAITools(tools),
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
      input: buildInput({
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
          input_tokens: number;
          output_tokens: number;
        }
      | null
      | undefined,
  ): void {
    context.totalInputTokens += usage?.input_tokens ?? 0;

    context.totalOutputTokens += usage?.output_tokens ?? 0;
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
      // Una consulta directa consume una request.
      this.usageLimiter.consume();
      const response = await this.create(
        prompt,
        maxTokens,
        systemPrompt,
        messages,
      );

      const text = response.output_text;

      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      this.recordUsage(1, inputTokens, outputTokens);

      return {
        text: text ?? "OpenAI no retornó contenido de texto en la respuesta",
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

      // Envía el historial acumulado al modelo.
      const response = await this.create(
        context.input,
        maxTokensTools,
        systemPrompt,
        undefined,
        availableTools,
      );

      // La llamada al proveedor se completó correctamente.
      this.addUsage(context, response.usage);

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
          item.type === "function_call",
      );

      // Retorna el contenido generado cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = response.output_text.trim();

        if (!text) {
          return this.buildResponse(
            "OpenAI no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        console.log("Respuesta final generada\n");

        return this.buildResponse(text, context);
      }

      // Agrega la salida del modelo al historial de la conversación.
      context.input.push(...toResponseInputItems(response.output));

      // Ejecuta las herramientas solicitadas por el modelo.
      const results = await this.toolExecutor.execute(
        toolCalls,
        tools,
        context.toolState,
        executeTool,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.input, results);
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
    onChunk,
  }: AgentRequest): Promise<AgentResponse> {
    // Ejecuta un único stream cuando no existen herramientas.
    if (!tools?.length) {
      let fullResponse = "";
      // Una consulta directa consume una request.
      this.usageLimiter.consume();
      const stream = await this.createStream(
        prompt,
        maxTokens,
        systemPrompt,
        messages,
      );

      // Acumula cada fragmento de texto recibido.
      stream.on("response.output_text.delta", (event) => {
        fullResponse += event.delta;

        // Entrega el fragmento al consumidor del cliente.
        onChunk?.(event.delta);
      });

      const finalResponse = await stream.finalResponse();

      const inputTokens = finalResponse.usage?.input_tokens ?? 0;
      const outputTokens = finalResponse.usage?.output_tokens ?? 0;

      this.recordUsage(1, inputTokens, outputTokens);

      return {
        text: fullResponse,
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

    // Ejecuta una nueva generación en streaming por cada iteración.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      // Acumula el texto generado durante la iteración actual.
      let streamedText = "";

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      const stream = await this.createStream(
        context.input,
        maxTokensTools,
        systemPrompt,
        undefined,
        availableTools,
      );

      stream.on("response.output_text.delta", (event) => {
        streamedText += event.delta;

        // Expone cada fragmento recibido.
        onChunk?.(event.delta);
      });

      // Obtiene la respuesta completa de la iteración.
      const response = await stream.finalResponse();

      // El stream corresponde a una llamada real al proveedor.
      this.addUsage(context, response.usage);

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls = response.output.filter(
        (item) => item.type === "function_call",
      );

      // Retorna el texto cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = streamedText.trim() || response.output_text.trim();

        if (!text) {
          return this.buildResponse(
            "OpenAI no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        console.log("Respuesta final generada\n");

        return this.buildResponse(text, context);
      }

      // Normaliza la salida antes de reutilizarla como input.
      const normalizedOutput = normalizeResponseOutput(response.output);
      // Agrega la salida del modelo al historial de la conversación.
      context.input.push(...toResponseInputItems(normalizedOutput));

      // Ejecuta las herramientas solicitadas por el modelo.
      const results = await this.toolExecutor.execute(
        toolCalls as OpenAiToolCall[],
        tools,
        context.toolState,
        executeTool,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.input, results);
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
