import { Ollama, Message as OllamaMessage } from "ollama";
import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
  ToolExecutionState,
} from "../../../../types/agent/index.js";
import { LlmClient } from "../../../../types/app/client.js";
import {
  buildConversation,
  toAgentMessages,
  toOllamaTools,
} from "./internal/index.js";
import { OllamaToolExecutor } from "./ollama-tool-executor.js";

import type {
  ExecutionContext,
  OllamaToolCall,
  StreamIterationResult,
} from "./ollama.types.js";
import {
  LlmUsageLimiterService,
  LlmUsageTrackerService,
} from "../../../../cost/index.js";

interface OllamaClientOptions {
  host: string;
  model: string;
  systemPrompt?: string;
  think: boolean;
  keepAlive: string;
  temperature: number;
  numCtx: number;
  usageLimiter: LlmUsageLimiterService;
  usageTracker: LlmUsageTrackerService;
}

/**
 * Cliente encargado de gestionar la comunicación con Ollama.
 */
export class OllamaClient implements LlmClient {
  // Cliente utilizado para realizar solicitudes a Ollama.
  private readonly client: Ollama;

  // Ejecutor de las herramientas solicitadas por el modelo.
  private readonly toolExecutor: OllamaToolExecutor;

  /** Controla y limita la cantidad de llamadas realizadas a los proveedores LLM. */
  private readonly usageLimiter: LlmUsageLimiterService;

  /** Registra y acumula el consumo real de tokens generado por las llamadas al LLM. */
  private readonly usageTracker: LlmUsageTrackerService;

  // Modelo utilizado para generar las respuestas.
  private readonly model: string;

  // Instrucciones específicas aplicadas al cliente Ollama.
  private readonly systemPrompt?: string;

  // Indica si Ollama debe habilitar el modo de razonamiento.
  private readonly think: boolean;

  // Tiempo que el modelo permanece cargado en memoria.
  private readonly keepAlive: string;

  // Temperatura utilizada durante la generación.
  private readonly temperature: number;

  // Tamaño máximo del contexto utilizado por el modelo.
  private readonly numCtx: number;

  /**
   * Crea una nueva instancia del cliente de Ollama.
   *
   * @param options Configuración utilizada para inicializar el cliente.
   * @param options.host Dirección del servidor de Ollama.
   * @param options.model Modelo de Ollama utilizado para generar respuestas.
   * @param options.systemPrompt Instrucciones específicas aplicadas al modelo Ollama.
   * @param options.think Indica si se habilita el modo de razonamiento.
   * @param options.keepAlive Tiempo que el modelo permanece cargado en memoria.
   * @param options.temperature Temperatura utilizada durante la generación.
   * @param options.numCtx Tamaño máximo del contexto utilizado por el modelo.
   */
  constructor({
    host,
    model,
    systemPrompt,
    think,
    keepAlive,
    temperature,
    numCtx,
    usageLimiter,
    usageTracker,
  }: OllamaClientOptions) {
    this.client = new Ollama({
      host,
    });
    this.model = model;
    this.usageLimiter = usageLimiter;
    this.usageTracker = usageTracker;
    this.systemPrompt = systemPrompt;
    this.think = think;
    this.keepAlive = keepAlive;
    this.temperature = temperature;
    this.numCtx = numCtx;
    this.toolExecutor = new OllamaToolExecutor();
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
      provider: "ollama",
      model: this.model,
      requests,
      inputTokens,
      outputTokens,
    });
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
    return this.client.chat({
      model: this.model,
      messages,
      tools: toOllamaTools(tools),
      think: this.think,
      stream: false,
      keep_alive: this.keepAlive,

      options: {
        temperature: this.temperature,
        num_predict: maxTokens,
        num_ctx: this.numCtx,
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
    return this.client.chat({
      model: this.model,
      messages,
      tools: toOllamaTools(tools),
      think: this.think,
      stream: true,
      keep_alive: this.keepAlive,

      options: {
        temperature: this.temperature,
        num_predict: maxTokens,
        num_ctx: this.numCtx,
      },
    });
  }

  /**
   * Construye el system prompt utilizado por Ollama.
   *
   * Combina las instrucciones de la conversación con las instrucciones
   * específicas configuradas para el cliente Ollama.
   *
   * @param systemPrompt System prompt opcional de la conversación.
   * @return System prompt utilizado por Ollama.
   */
  private buildSystemPrompt(systemPrompt?: string): string | undefined {
    if (systemPrompt && this.systemPrompt) {
      return `${systemPrompt}\n${this.systemPrompt}`;
    }

    return systemPrompt ?? this.systemPrompt;
  }

  /**
   * Crea el contexto inicial para una conversación con herramientas.
   *
   * @param prompt Mensaje inicial enviado por el usuario.
   * @param systemPrompt Prompt de sistema utilizado durante la conversación.
   * @param messages Historial opcional de conversación.
   * @param toolState Estado de ejecución de herramientas del turno actual.
   * @return Contexto inicial de ejecución.
   */
  private createExecutionContext(
    prompt: string,
    systemPrompt: string,
    messages: AgentRequest["messages"],
    toolState: ToolExecutionState,
  ): ExecutionContext {
    return {
      conversation: buildConversation({
        prompt,
        systemPrompt: this.buildSystemPrompt(systemPrompt),
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
    // Registra toda la ejecución, incluidas las iteraciones con tools.
    this.recordUsage(1, context.totalInputTokens, context.totalOutputTokens);
    return {
      text,
      totalInputTokens: context.totalInputTokens,
      totalOutputTokens: context.totalOutputTokens,
      toolsUsed: [...context.toolState.toolsUsed],
      toolCallsLastTurn: context.toolState.toolCallsLastTurn,

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
      const conversation = buildConversation({
        prompt,
        systemPrompt: this.buildSystemPrompt(systemPrompt),
        messages,
      });
      // Una consulta directa consume una request.
      this.usageLimiter.consume();
      const response = await this.create(maxTokens, conversation);

      const text =
        response.message.content?.trim() ||
        "Ollama no retornó contenido de texto en la respuesta.";

      const inputTokens = response.prompt_eval_count ?? 0;
      const outputTokens = response.eval_count ?? 0;

      // Registra el consumo correspondiente a la llamada directa.
      this.recordUsage(1, inputTokens, outputTokens);

      return {
        text,
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
    const context = this.createExecutionContext(
      prompt,
      systemPrompt ?? "",
      messages,
      toolState,
    );

    // Ejecuta iteraciones hasta obtener una respuesta final o alcanzar el límite.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      const response = await this.create(
        maxTokensTools,
        context.conversation,
        availableTools,
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
        executeTool,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.conversation, results);
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
      const conversation = buildConversation({
        prompt,
        systemPrompt: this.buildSystemPrompt(systemPrompt),
        messages,
      });

      // Una consulta directa consume una request.
      this.usageLimiter.consume();
      const stream = await this.createStream(maxTokens, conversation);

      let fullResponse = "";
      let inputTokens = 0;
      let outputTokens = 0;

      // Procesa los fragmentos generados durante el stream.
      for await (const chunk of stream) {
        const text = chunk.message.content ?? "";
        if (text) {
          fullResponse += text;
          // Expone el fragmento al consumidor.
          onChunk?.(text);
        }

        if (chunk.done) {
          inputTokens = chunk.prompt_eval_count ?? inputTokens;
          outputTokens = chunk.eval_count ?? outputTokens;
        }
      }

      const text =
        fullResponse.trim() ||
        "Ollama no retornó contenido de texto en la respuesta.";

      this.recordUsage(1, inputTokens, outputTokens);

      return {
        text,
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
    const context = this.createExecutionContext(
      prompt,
      systemPrompt ?? "",
      messages,
      toolState,
    );

    // Ejecuta una nueva generación en streaming por cada iteración.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      const result = await this.executeStreamIteration(
        context.conversation,
        maxTokensTools,
        availableTools,
        onChunk,
      );

      this.addUsage(context, result.inputTokens, result.outputTokens);

      // Retorna el contenido cuando no existen llamadas a herramientas.
      if (result.toolCalls.length === 0) {
        const text = result.text.trim();

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
        executeTool,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.conversation, toolResults);
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
   * Ejecuta una iteración completa mediante streaming.
   *
   * @param conversation Historial actual de la conversación.
   * @param maxTokensTools Máximo de tokens permitidos durante la iteración con herramientas.
   * @param tools Herramientas opcionales disponibles para el modelo.
   * @return Resultado completo de la iteración.
   */
  private async executeStreamIteration(
    conversation: OllamaMessage[],
    maxTokensTools: number,
    tools: ToolDefinition[] | undefined,
    onChunk: ((chunk: string) => void) | undefined,
  ): Promise<StreamIterationResult> {
    const stream = await this.createStream(maxTokensTools, conversation, tools);

    let fullResponse = "";
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
      const text = chunk.message.content ?? "";
      if (text) {
        fullResponse += text;
        assistantMessage.content += text;
        // Expone el fragmento al consumidor.
        onChunk?.(text);
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
      text: fullResponse,
      assistantMessage,
      toolCalls,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }
}
