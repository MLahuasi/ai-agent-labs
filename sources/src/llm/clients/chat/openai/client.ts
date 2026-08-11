import OpenAI from "openai";

import { config } from "../../../../config/index.js";
import { LlmClient } from "../../../../types/app/index.js";

import {
  AgentRequest,
  AgentResponse,
  Message,
  ToolDefinition,
} from "../../../../types/agent/index.js";

import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems.js";
import { buildInput, toOpenAITools } from "./internal/index.js";
import { OpenAiToolExecutor } from "./openai-tool-executor.js";
import { ExecutionContext, OpenAiToolCall } from "./openai.types.js";

/**
 * Cliente encargado de gestionar la comunicación con OpenAI.
 */
export class OpenAiClient implements LlmClient {
  // Cliente utilizado para realizar solicitudes a OpenAI.
  private readonly client: OpenAI;

  // Ejecutor de las herramientas solicitadas por el modelo.
  private readonly toolExecutor: OpenAiToolExecutor;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    this.toolExecutor = new OpenAiToolExecutor();
  }

  /**
   * Realiza una consulta completa mediante Responses API.
   *
   * @param input Prompt o historial enviado al modelo.
   * @param maxTokens Máximo de tokens permitidos en la respuesta.
   * @param systemPrompt Instrucciones opcionales para el modelo.
   * @param messages Historial opcional de conversación.
   * @param previousResponseId Identificador opcional de una respuesta anterior.
   * @param tools Herramientas opcionales disponibles para el modelo.
   * @return Respuesta completa generada por OpenAI.
   */
  private async create(
    input: string | OpenAI.Responses.ResponseInput,
    maxTokens: number,
    systemPrompt?: string,
    messages?: Message[],
    previousResponseId?: string,
    tools?: ToolDefinition[],
  ) {
    return this.client.responses.create({
      model: config.openaiModel,

      ...(systemPrompt && {
        instructions: systemPrompt,
      }),

      ...(previousResponseId && {
        previous_response_id: previousResponseId,
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
   * @param previousResponseId Identificador opcional de una respuesta anterior.
   * @param tools Herramientas opcionales disponibles para el modelo.
   * @return Stream generado por OpenAI.
   */
  private async createStream(
    input: string | OpenAI.Responses.ResponseInput,
    maxTokens: number,
    systemPrompt?: string,
    messages?: Message[],
    previousResponseId?: string,
    tools?: ToolDefinition[],
  ) {
    return this.client.responses.stream({
      model: config.openaiModel,

      ...(systemPrompt && {
        instructions: systemPrompt,
      }),

      ...(previousResponseId && {
        previous_response_id: previousResponseId,
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
   * @return Contexto inicial de ejecución.
   */
  private createExecutionContext(
    prompt: string,
    messages?: Message[],
  ): ExecutionContext {
    return {
      input: buildInput({
        prompt,
        messages,
      }),
      totalInputTokens: 0,
      totalOutputTokens: 0,
      toolState: {
        toolsUsed: new Set(),
        executedToolCalls: new Set(),
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
   * @param request.systemPrompt Instrucciones opcionales para el modelo.
   * @param request.messages Historial opcional de conversación.
   * @param request.tools Herramientas opcionales disponibles para el modelo.
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
        prompt,
        config.max_tokens,
        systemPrompt,
        messages,
      );

      const text = response.output_text;

      return {
        text: text || "OpenAI no retornó contenido de texto en la respuesta",
        totalInputTokens: response.usage?.input_tokens ?? 0,
        totalOutputTokens: response.usage?.output_tokens ?? 0,
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
        context.input,
        config.max_tokens_tools,
        systemPrompt,
        undefined,
        undefined,
        tools,
      );

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
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.input, results);
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
   * @param request.messages Historial opcional de conversación.
   * @param request.tools Herramientas opcionales disponibles para el modelo.
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
        prompt,
        config.max_tokens,
        systemPrompt,
        messages,
      );

      // Acumula cada fragmento de texto recibido.
      stream.on("response.output_text.delta", (event) => {
        process.stdout.write(event.delta);
        fullResponse += event.delta;
      });

      const finalResponse = await stream.finalResponse();

      process.stdout.write("\n");

      return {
        text: fullResponse,
        totalInputTokens: finalResponse.usage?.input_tokens ?? 0,
        totalOutputTokens: finalResponse.usage?.output_tokens ?? 0,
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
        context.input,
        config.max_tokens_tools,
        systemPrompt,
        undefined,
        undefined,
        tools,
      );

      stream.on("response.output_text.delta", (event) => {
        process.stdout.write(event.delta);
        streamedText += event.delta;
      });

      // Obtiene la respuesta completa de la iteración.
      const response = await stream.finalResponse();

      this.addUsage(context, response.usage);

      // Extrae las llamadas a herramientas generadas por el modelo.
      const toolCalls = response.output.filter(
        (item) => item.type === "function_call",
      );

      // Retorna el texto cuando no existen llamadas a herramientas.
      if (toolCalls.length === 0) {
        const text = streamedText.trim() || response.output_text.trim();

        process.stdout.write("\n");

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
        toolCalls as OpenAiToolCall[],
        tools,
        context.toolState,
      );

      // Agrega los resultados para la siguiente iteración.
      this.toolExecutor.appendResults(context.input, results);
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
