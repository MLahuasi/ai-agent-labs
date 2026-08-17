import Groq from "groq-sdk";
import { LlmClient } from "../../../../types/app/index.js";
import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
  ToolExecutionState,
} from "../../../../types/agent/index.js";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import {
  buildConversation,
  responseToMessage,
  toGroqTools,
} from "./internal/index.js";
import { GroqToolExecutor } from "./groq-tool-executor.js";
import {
  ExecutionContext,
  GroqToolCall,
  StreamToolCall,
} from "./groq.types.js";

/**
 * Cliente encargado de gestionar la comunicación con Groq.
 */
export class GroqClient implements LlmClient {
  // Cliente utilizado para realizar solicitudes a Groq.
  private readonly client: Groq;

  // Ejecutor de las herramientas solicitadas por el modelo.
  private readonly toolExecutor: GroqToolExecutor;

  // Modelo utilizado para generar las respuestas.
  private readonly model: string;

  /**
   * Crea una nueva instancia del cliente de Groq.
   *
   * @param params Configuración necesaria para inicializar el cliente.
   * @param params.apiKey Clave de API utilizada para autenticar las solicitudes.
   * @param params.model Modelo de Groq utilizado para generar respuestas.
   */
  constructor({ apiKey, model }: { apiKey: string; model: string }) {
    this.client = new Groq({
      apiKey,
    });

    this.model = model;
    this.toolExecutor = new GroqToolExecutor();
  }

  /**
   * Realiza una consulta completa mediante Groq.
   *
   * @param maxTokens Máximo de tokens permitidos.
   * @param messages Historial enviado al modelo.
   * @param tools Herramientas opcionales.
   * @return Respuesta completa generada por Groq.
   */
  private async create(
    maxTokens: number,
    messages: ChatCompletionMessageParam[],
    tools?: ToolDefinition[],
  ) {
    const convertedTools = toGroqTools(tools);

    return this.client.chat.completions.create({
      model: this.model,
      messages,
      max_completion_tokens: maxTokens,

      ...(convertedTools && {
        tools: convertedTools,

        // Permite que el modelo decida si necesita una herramienta.
        tool_choice: "auto" as const,

        // Deshabilita las llamadas paralelas a herramientas.
        parallel_tool_calls: false,
      }),
    });
  }

  /**
   * Realiza una consulta mediante streaming.
   *
   * @param maxTokens Máximo de tokens permitidos.
   * @param messages Historial enviado al modelo.
   * @param tools Herramientas opcionales.
   * @return Stream generado por Groq.
   */
  private async createStream(
    maxTokens: number,
    messages: ChatCompletionMessageParam[],
    tools?: ToolDefinition[],
  ) {
    const convertedTools = toGroqTools(tools);

    return this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages,
      max_completion_tokens: maxTokens,

      ...(convertedTools && {
        tools: convertedTools,
        tool_choice: "auto" as const,
        // Deshabilita las llamadas paralelas a herramientas.
        parallel_tool_calls: false,
      }),
    });
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
        systemPrompt,
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
          prompt_tokens: number;
          completion_tokens: number;
        }
      | null
      | undefined,
  ): void {
    context.totalInputTokens += usage?.prompt_tokens ?? 0;

    context.totalOutputTokens += usage?.completion_tokens ?? 0;
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
        maxTokens,
        buildConversation({
          prompt,
          systemPrompt,
          messages,
        }),
      );

      const text =
        response.choices[0]?.message?.content?.trim() ||
        "Groq no retornó contenido de texto en la respuesta";

      return {
        text,
        totalInputTokens: response.usage?.prompt_tokens ?? 0,
        totalOutputTokens: response.usage?.completion_tokens ?? 0,
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

      this.addUsage(context, response.usage);

      const assistantMessage = response.choices[0]?.message;

      // Valida que Groq haya retornado un mensaje.
      if (!assistantMessage) {
        return this.buildResponse(
          "Groq no retornó un mensaje en la respuesta.",
          context,
        );
      }

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls =
        assistantMessage.tool_calls?.filter(
          (toolCall) => toolCall.type === "function",
        ) ?? [];

      // Retorna el contenido generado cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = assistantMessage.content?.trim();

        if (!text) {
          return this.buildResponse(
            "Groq no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        return this.buildResponse(text, context);
      }

      // Agrega la salida del modelo al historial de la conversación.
      context.conversation.push(responseToMessage(response));

      // Ejecuta las herramientas solicitadas por el modelo.
      const results = await this.toolExecutor.execute(
        toolCalls,
        tools,
        context.toolState,
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
      let promptTokens = 0;
      let completionTokens = 0;

      const stream = await this.createStream(
        maxTokens,
        buildConversation({
          prompt,
          systemPrompt,
          messages,
        }),
      );

      // Procesa los fragmentos generados durante el stream.
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? "";
        fullResponse += content;

        const usage = chunk.x_groq?.usage;

        if (usage) {
          promptTokens = usage.prompt_tokens;

          completionTokens = usage.completion_tokens;
        }
      }

      const text =
        fullResponse.trim() ||
        "Groq no retornó contenido de texto en la respuesta";

      return {
        text,
        totalInputTokens: promptTokens,
        totalOutputTokens: completionTokens,
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
    const context = this.createExecutionContext(
      prompt,
      systemPrompt ?? "",
      messages,
      toolState,
    );

    // Ejecuta una nueva generación en streaming por cada iteración.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      let streamedText = "";

      // Acumula las llamadas a herramientas de la iteración.
      const streamedToolCalls = new Map<number, StreamToolCall>();

      let promptTokens = 0;
      let completionTokens = 0;

      const availableTools =
        context.toolState.toolCallsLastTurn < context.toolState.maxToolCalls
          ? tools
          : undefined;

      const stream = await this.createStream(
        maxTokensTools,
        context.conversation,
        availableTools,
      );

      // Procesa los fragmentos generados durante la iteración.
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        const content = delta?.content ?? "";

        if (content) {
          streamedText += content;
        }

        // Reconstruye las llamadas a herramientas recibidas por fragmentos.
        for (const toolCallDelta of delta?.tool_calls ?? []) {
          const index = toolCallDelta.index;

          const current = streamedToolCalls.get(index) ?? {
            arguments: "",
          };

          if (toolCallDelta.id) {
            current.id = toolCallDelta.id;
          }

          if (toolCallDelta.function?.name) {
            current.name = toolCallDelta.function.name;
          }

          if (toolCallDelta.function?.arguments) {
            current.arguments += toolCallDelta.function.arguments;
          }

          streamedToolCalls.set(index, current);
        }

        const usage = chunk.x_groq?.usage;

        if (usage) {
          promptTokens = usage.prompt_tokens;

          completionTokens = usage.completion_tokens;
        }
      }

      context.totalInputTokens += promptTokens;

      context.totalOutputTokens += completionTokens;

      // Construye las llamadas completas respetando el orden recibido.
      const toolCalls: GroqToolCall[] = [...streamedToolCalls.entries()]
        .sort(([first], [second]) => first - second)
        .map(([, toolCall]) => ({
          id: toolCall.id ?? "",
          function: {
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
        }));

      // Retorna el texto cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = streamedText.trim();

        if (!text) {
          return this.buildResponse(
            "Groq no retornó texto ni llamadas a herramientas.",
            context,
          );
        }

        return this.buildResponse(text, context);
      }

      // Agrega la salida del modelo al historial de la conversación.
      context.conversation.push({
        role: "assistant",
        content: streamedText || null,
        tool_calls: toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function" as const,
          function: {
            name: toolCall.function.name ?? "",
            arguments: toolCall.function.arguments,
          },
        })),
      });

      // Ejecuta las herramientas solicitadas por el modelo.
      const results = await this.toolExecutor.execute(
        toolCalls,
        tools,
        context.toolState,
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
}
