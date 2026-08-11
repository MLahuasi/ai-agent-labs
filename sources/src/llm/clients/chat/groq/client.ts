import Groq from "groq-sdk";
import { config } from "../../../../config/index.js";
import { LlmClient } from "../../../../types/app/index.js";
import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
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

  constructor() {
    this.client = new Groq({
      apiKey: config.groqApiKey,
    });

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
      model: config.groqModel,
      messages,
      max_tokens: maxTokens,

      ...(convertedTools && {
        tools: convertedTools,

        // Permite que el modelo decida si necesita una herramienta.
        tool_choice: "auto" as const,

        // Ejecuta una herramienta por turno.
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
   * Crea el contexto inicial para una conversación con herramientas.
   *
   * @param request Datos de la conversación.
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
        systemPrompt,
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
    };
  }

  /**
   * Genera una respuesta completa y procesa las herramientas solicitadas.
   *
   * @param request Datos necesarios para generar la respuesta.
   * @param request.prompt Mensaje inicial.
   * @param request.systemPrompt Instrucciones opcionales.
   * @param request.messages Historial opcional.
   * @param request.tools Herramientas opcionales.
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
        config.max_tokens,
        buildConversation({
          prompt,
          systemPrompt,
          messages,
        }),
      );

      const text = response.choices[0]?.message?.content;

      return {
        text: text ?? "Groq no retornó contenido de texto en la respuesta",
        totalInputTokens: response.usage?.prompt_tokens ?? 0,
        totalOutputTokens: response.usage?.completion_tokens ?? 0,
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
        config.max_tokens,
        context.conversation,
        tools,
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
   * @param request.prompt Mensaje inicial.
   * @param request.systemPrompt Instrucciones opcionales.
   * @param request.messages Historial opcional.
   * @param request.tools Herramientas opcionales.
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
      let promptTokens = 0;
      let completionTokens = 0;

      const stream = await this.createStream(
        config.max_tokens,
        buildConversation({
          prompt,
          systemPrompt,
          messages,
        }),
      );

      // Procesa los fragmentos generados durante el stream.
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? "";

        process.stdout.write(content);

        fullResponse += content;

        const usage = chunk.x_groq?.usage;

        if (usage) {
          promptTokens = usage.prompt_tokens;

          completionTokens = usage.completion_tokens;
        }
      }

      process.stdout.write("\n");

      return {
        text: fullResponse,
        totalInputTokens: promptTokens,
        totalOutputTokens: completionTokens,
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

      let streamedText = "";

      // Acumula las llamadas a herramientas de la iteración.
      const streamedToolCalls = new Map<number, StreamToolCall>();

      let promptTokens = 0;
      let completionTokens = 0;

      const stream = await this.createStream(
        config.max_tokens,
        context.conversation,
        tools,
      );

      // Procesa los fragmentos generados durante la iteración.
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        const content = delta?.content ?? "";

        if (content) {
          process.stdout.write(content);
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

        process.stdout.write("\n");

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
}
