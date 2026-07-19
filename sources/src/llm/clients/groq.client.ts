import OpenAI from "openai";

import { AskResponse, LlmClient, Message } from "../../types/index.js";
import { config } from "../../config/index.js";

/**
 * Implementación del cliente Groq.
 *
 * Groq es compatible con la API de OpenAI,
 * por lo que reutilizamos el SDK openai.
 *
 * Gracias a esto, el resto de la aplicación
 * no necesita conocer detalles específicos
 * de Groq.
 */
export class GroqClient implements LlmClient {
  /**
   * Instancia privada del cliente.
   */
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
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
  private buildMessages(prompt: string, messages?: Message[]) {
    const conversation = messages?.length
      ? messages
      : [
          {
            role: "user" as const,
            content: prompt,
          },
        ];

    return conversation;
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
    const response = await this.client.chat.completions.create({
      model: config.groqModel,
      messages: [
        ...(systemPrompt
          ? [
              {
                role: "system" as const,
                content: systemPrompt,
              },
            ]
          : []),
        ...this.buildMessages(prompt, messages),
      ],
      max_tokens: config.max_tokens,
      stream_options: {
        include_usage: true,
      },
    });

    const text = response.choices[0]?.message?.content;

    if (!text) {
      throw new Error("Groq no retornó contenido de texto en la respuesta");
    }

    return {
      text,
      totalInputTokens: response.usage?.prompt_tokens ?? 0,
      totalOutputTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  /**
   * Genera una respuesta mediante streaming.
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
    let promptTokens = 0;
    let completionTokens = 0;

    const stream = await this.client.chat.completions.create({
      model: config.groqModel,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      messages: [
        ...(systemPrompt
          ? [
              {
                role: "system" as const,
                content: systemPrompt,
              },
            ]
          : []),
        ...this.buildMessages(prompt, messages),
      ],
      max_tokens: config.max_tokens,
    });

    /**
     * Se ejecuta cada vez que Groq
     * genera un nuevo fragmento de texto.
     */
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";

      process.stdout.write(delta);

      fullResponse += delta;

      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;

        completionTokens = chunk.usage.completion_tokens;
      }
    }

    /**
     * Salto de línea para mejorar la
     * visualización en consola.
     */
    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens: promptTokens,
      totalOutputTokens: completionTokens,
    };
  }
}
