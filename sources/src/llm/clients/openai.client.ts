import OpenAI from "openai";

import { AskResponse, LlmClient, Message } from "../../types/index.js";
import { config } from "../../config/index.js";

/**
 * Implementación del cliente OpenAI.
 *
 * Esta clase adapta el SDK oficial de OpenAI
 * al contrato definido por la interfaz LlmClient.
 *
 * Gracias a esto, el resto de la aplicación
 * no necesita conocer detalles específicos
 * de OpenAI.
 */
export class OpenAiClient implements LlmClient {
  /**
   * Instancia privada del SDK oficial.
   */
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /**
   * Construye la lista de mensajes que será
   * enviada al modelo.
   *
   * Si existe un historial de conversación,
   * se utiliza dicho historial.
   *
   * En caso contrario, se crea una conversación
   * mínima utilizando únicamente el prompt actual.
   */
  private buildMessages(prompt: string, messages?: Message[]): Message[] {
    if (messages?.length) {
      return messages.filter((message) => message.role !== "system");
    }

    return [
      {
        role: "user",
        content: prompt,
      },
    ];
  }

  /**
   * Genera una respuesta completa.
   *
   * Espera a que el modelo termine la generación
   * antes de retornar el resultado.
   */
  async ask(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    const response = await this.client.responses.create({
      model: config.openaiModel,
      ...(systemPrompt && {
        instructions: systemPrompt,
      }),

      input: this.buildMessages(prompt, messages),
      max_output_tokens: config.max_tokens,
    });

    const text = response.output_text;

    if (!text) {
      throw new Error("OpenAI no retornó contenido de texto en la respuesta");
    }

    return {
      text,
      totalInputTokens: response.usage?.input_tokens ?? 0,
      totalOutputTokens: response.usage?.output_tokens ?? 0,
    };
  }

  /**
   * Genera una respuesta utilizando streaming.
   *
   * Mientras el modelo genera contenido,
   * este se imprime en consola y se acumula
   * en la variable fullResponse.
   */
  async stream(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    let fullResponse = "";
    const stream = await this.client.responses.stream({
      model: config.openaiModel,
      ...(systemPrompt && {
        instructions: systemPrompt,
      }),

      input: this.buildMessages(prompt, messages),
      max_output_tokens: config.max_tokens,
    });

    /**
     * Se ejecuta cada vez que OpenAI
     * genera un nuevo fragmento de texto.
     */
    stream.on("response.output_text.delta", (event) => {
      process.stdout.write(event.delta);
      fullResponse += event.delta;
    });

    /**
     * Espera a que finalice completamente
     * la generación de la respuesta.
     */
    const finalResponse = await stream.finalResponse();

    /**
     * Salto de línea para mejorar la
     * visualización en consola.
     */
    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens: finalResponse.usage?.input_tokens ?? 0,
      totalOutputTokens: finalResponse.usage?.output_tokens ?? 0,
    };
  }
}
