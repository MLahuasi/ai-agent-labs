import { GoogleGenAI } from "@google/genai";

import { AskResponse, LlmClient, Message } from "../../types/index.js";
import { config } from "../../config/index.js";

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
   * Convierte el historial de mensajes interno
   * al formato esperado por Gemini.
   *
   * Mapeo de roles:
   * - user      -> user
   * - assistant -> model
   * - system    -> ignorado
   *
   * Si no se recibe historial, se construye
   * un único mensaje utilizando el prompt.
   */
  private buildContents(prompt: string, messages?: Message[]) {
    if (!messages?.length) {
      return [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ];
    }

    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: m.content,
          },
        ],
      }));
  }

  /**
   * Genera una respuesta completa.
   *
   * Espera a que Gemini termine la generación
   * antes de retornar el resultado.
   */
  async ask(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    const response = await this.client.models.generateContent({
      model: config.geminiModel,
      contents: this.buildContents(prompt, messages),
      ...(systemPrompt && {
        config: {
          systemInstruction: systemPrompt,
        },
      }),
    });

    const text = response.text;

    if (!text) {
      throw new Error("Gemini no retornó contenido de texto");
    }

    return {
      text,
      totalInputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      totalOutputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  /**
   * Genera una respuesta utilizando streaming.
   *
   * Mientras Gemini genera contenido,
   * este se imprime en consola y se acumula
   * en la variable fullResponse.
   */
  async stream(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    let fullResponse = "";
    const stream = await this.client.models.generateContentStream({
      model: config.geminiModel,
      contents: this.buildContents(prompt, messages),
      ...(systemPrompt && {
        config: {
          systemInstruction: systemPrompt,
        },
      }),
    });

    let lastChunk: any;

    /**
     * Se ejecuta cada vez que Gemini
     * genera un nuevo fragmento de texto.
     */
    for await (const chunk of stream) {
      lastChunk = chunk;

      const text = chunk.text ?? "";

      process.stdout.write(text);

      fullResponse += text;
    }

    /**
     * Salto de línea para mejorar
     * la visualización en consola.
     */
    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens: lastChunk?.usageMetadata?.promptTokenCount ?? 0,
      totalOutputTokens: lastChunk?.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
