import { GoogleGenAI, type Content } from "@google/genai";

import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";

import {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
} from "../../../types/agent/index.js";
import { executeFileTool } from "../../../tools/executor/index.js";
import { buildContents, toGeminiTools } from "./internal/index.js";
import { tryGetStringKeyedObject } from "../../../utils/data/object.guards.js";
import { validateRequiredArguments } from "../../../utils/tools/tool.guards.js";

/**
 * Implementación del cliente Gemini.
 *
 * Esta clase adapta el SDK oficial de Google
 * al contrato definido por la interfaz LlmClient.
 *
 * Gracias a esto, el resto de la aplicación
 * permanece desacoplado de los detalles
 * específicos de Gemini.
 */
//export class GeminiClient implements LlmClient<GeminiToolParametersDefinition> {
export class GeminiClient implements LlmClient {
  /**
   * Instancia privada del SDK oficial.
   */
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({
      apiKey: config.geminiApiKey,
    });
  }

  /**
   * Ejecuta una petición completa contra Gemini.
   *
   * El parámetro contents puede contener:
   * - mensajes de usuario;
   * - respuestas anteriores del modelo;
   * - functionCall;
   * - functionResponse.
   */
  private async create(
    contents: Content[],
    maxTokens: number,
    systemPrompt?: string,
    tools?: ToolDefinition[],
  ) {
    return await this.client.models.generateContent({
      model: config.geminiModel,
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
   * Ejecuta una petición mediante streaming.
   */
  private async createStream(
    contents: Content[],
    maxTokens: number,
    systemPrompt?: string,
    tools?: ToolDefinition[],
  ) {
    return await this.client.models.generateContentStream({
      model: config.geminiModel,
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
   * Genera una respuesta completa.
   *
   * Espera a que Gemini termine la generación
   * antes de retornar el resultado.
   */
  async ask({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    const response = await this.create(
      buildContents({ prompt, messages }),
      config.max_tokens,
      systemPrompt,
    );

    const text = response.text;

    if (!text) {
      return {
        text: "Gemini no retornó contenido de texto en la respuesta",
        totalInputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        totalOutputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        toolsUsed: [],
      };
    }

    return {
      text,
      totalInputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      totalOutputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      toolsUsed: [],
    };
  }

  /**
   * Genera una respuesta utilizando streaming.
   *
   * Mientras Gemini genera contenido,
   * este se imprime en consola y se acumula
   * en la variable fullResponse.
   */
  async stream({
    prompt,
    systemPrompt,
    messages,
  }: AgentRequest): Promise<AgentResponse> {
    let fullResponse = "";

    const stream = await this.createStream(
      buildContents({ prompt, messages }),
      config.max_tokens,
      systemPrompt,
    );

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    /**
     * Se ejecuta cada vez que Gemini
     * genera un nuevo fragmento de texto.
     */
    for await (const chunk of stream) {
      const text = chunk.text ?? "";

      process.stdout.write(text);
      fullResponse += text;

      /**
       * usageMetadata suele aparecer en los últimos chunks.
       * Se sobrescriben los valores únicamente cuando existen.
       */
      totalInputTokens =
        chunk.usageMetadata?.promptTokenCount ?? totalInputTokens;

      totalOutputTokens =
        chunk.usageMetadata?.candidatesTokenCount ?? totalOutputTokens;
    }

    /**
     * Salto de línea para mejorar
     * la visualización en consola.
     */
    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens,
      totalOutputTokens,
      toolsUsed: [],
    };
  }

  /**
   * Ejecuta una conversación con Gemini permitiendo que el modelo invoque
   * herramientas durante el proceso.
   *
   * El flujo se repite hasta que:
   * - El modelo genera una respuesta final.
   * - Se alcanza el límite máximo de iteraciones.
   * - Gemini retorna una respuesta sin texto ni llamadas a herramientas.
   */
  async askWithTools({
    prompt,
    systemPrompt,
    messages,
    tools,
  }: AgentRequest): Promise<AgentResponse> {
    // Acumula el consumo total de todas las llamadas al modelo.
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Registra los nombres de las herramientas ejecutadas.
    const toolsUsed = new Set<string>();

    /**
     * Registra las llamadas ya ejecutadas.
     *
     * Evita que el modelo invoque indefinidamente la misma
     * herramienta con exactamente los mismos argumentos.
     */
    const executedToolCalls = new Set<string>();

    /**
     * Mantiene el historial completo en el formato nativo de Gemini.
     *
     * Este arreglo se modifica durante cada iteración agregando:
     * - el contenido generado por el modelo;
     * - los functionCall;
     * - los functionResponse.
     */
    const geminiContents: Content[] = buildContents({
      prompt,
      messages,
    });

    // Cada iteración representa una llamada al modelo.
    for (let iteration = 0; iteration < config.max_iterations; iteration++) {
      console.log(`\nPensando... (iteración ${iteration + 1})`);

      // Se envía siempre el historial completo acumulado.
      const response = await this.create(
        geminiContents,
        config.max_tokens_tools,
        systemPrompt,
        tools,
      );

      totalInputTokens += response.usageMetadata?.promptTokenCount ?? 0;
      totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;

      const toolCalls = response.functionCalls ?? [];

      // const candidate = response.candidates?.[0];

      // console.dir(
      //   {
      //     responseId: response.responseId,

      //     model: response.modelVersion,

      //     content: response.text ?? "",

      //     toolCalls: toolCalls.map((toolCall) => ({
      //       callId: toolCall.id,
      //       name: toolCall.name,
      //       arguments: toolCall.args ?? {},
      //     })),

      //     doneReason:
      //       toolCalls.length > 0
      //         ? "tool_calls"
      //         : candidate?.finishReason === "STOP"
      //           ? "stop"
      //           : (candidate?.finishReason?.toLowerCase() ?? "unknown"),

      //     usage: {
      //       inputTokens: response.usageMetadata?.promptTokenCount,
      //       outputTokens: response.usageMetadata?.candidatesTokenCount,
      //       totalTokens: response.usageMetadata?.totalTokenCount,
      //     },
      //   },
      //   {
      //     depth: null,
      //   },
      // );

      /**
       * Si no existen llamadas a tools, la respuesta del modelo
       * se considera definitiva.
       */
      if (toolCalls.length === 0) {
        const text = response.text;

        if (!text) {
          console.warn("Gemini no retornó texto ni llamadas a herramientas.");

          return {
            text: "Gemini no retornó texto ni llamadas a herramientas.",
            totalInputTokens,
            totalOutputTokens,
            toolsUsed: [...toolsUsed],
          };
        }

        console.log("Respuesta final generada\n");

        return {
          text,
          totalInputTokens,
          totalOutputTokens,
          toolsUsed: [...toolsUsed],
        };
      }

      /**
       * Conserva la salida completa del modelo.
       *
       * Es importante conservar el Content original porque puede contener:
       * - functionCall;
       * - texto;
       * - thought signatures;
       * - identificadores internos.
       */
      const content = response.candidates?.[0]?.content;
      if (!content)
        return {
          text: "Gemini no retornó un content.",
          totalInputTokens,
          totalOutputTokens,
          toolsUsed: [...toolsUsed],
        };

      geminiContents.push(content);

      // Ejecuta todas las herramientas solicitadas en paralelo.
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const toolName = toolCall.name;
          const callId = toolCall.id;

          const currentTool = tools?.find((tool) => tool.name === toolName);

          if (!currentTool) {
            return {
              callId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "tool_not_found",
                message: `La herramienta "${toolName}" no está registrada.`,
              }),
            };
          }

          const params = tryGetStringKeyedObject(toolCall.args);
          if (!params) {
            return {
              callId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "invalid_arguments",
                message:
                  `Los argumentos de "${toolName}" ` +
                  "no contienen un objeto JSON válido.",
              }),
            };
          }

          const validation = validateRequiredArguments(currentTool, params);
          if (!validation.valid) {
            return {
              callId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "missing_required_arguments",
                message: `Faltan argumentos requeridos para "${toolName}".`,
                missing: validation.missing,
              }),
            };
          }

          /**
           * Se crea una firma estable para detectar
           * llamadas repetidas.
           *
           * En este caso JSON.stringify es suficiente porque
           * los argumentos provienen directamente del modelo.
           */
          const callSignature = JSON.stringify({
            name: toolName,
            arguments: params,
          });

          if (executedToolCalls.has(callSignature)) {
            console.warn(`Llamada duplicada detectada: ${toolName}`);
            return {
              callId,
              name: toolName,
              output: JSON.stringify({
                success: false,
                error: "duplicated_tool_call",
                message:
                  `La herramienta "${toolName}" ya fue ejecutada ` +
                  "con los mismos argumentos.",
              }),
            };
          }

          executedToolCalls.add(callSignature);

          console.log(
            `Ejecutando tool: ${toolName} ` + `(${JSON.stringify(params)})`,
          );

          try {
            let output = await executeFileTool(toolName!, params);
            toolsUsed.add(toolName!);

            if (!output?.trim()) {
              output = JSON.stringify({
                success: false,
                error: "empty_tool_result",
                message: `La herramienta "${toolName}" no devolvió contenido.`,
              });
            }

            console.log(`Herramienta completada: ${toolCall.name}`);
            return {
              callId,
              name: toolName,
              output,
            };
          } catch (error) {
            return {
              callId,
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

      /**
       * En Gemini, el resultado de una función se devuelve
       * como un Content con role "user" y partes functionResponse.
       */
      geminiContents.push({
        role: "user",
        parts: toolResults.map((result) => ({
          functionResponse: {
            ...(result.callId && {
              id: result.callId,
            }),
            name: result.name,
            response: {
              output: result.output,
            },
          },
        })),
      });
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
