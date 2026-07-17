import config from "../../config/index.js";
import {
  AskResponse,
  LlmClient,
  OllamaGenerateResponse,
} from "../interfaces/index.js";

import { Message } from "../../types/index.js";

/**
 * Implementación del cliente Ollama.
 *
 * Este cliente utiliza una instancia local
 * de Ollama para ejecutar modelos de lenguaje
 * sin depender de servicios externos.
 */
export class OllamaClient implements LlmClient {
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
    const conversation: Message[] = messages?.length
      ? messages
      : [
          {
            role: "user",
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
    const conversation = [
      ...(systemPrompt
        ? [
            {
              role: "system" as const,
              content: systemPrompt,
            },
          ]
        : []),
      ...this.buildMessages(prompt, messages),
    ];

    const response = await fetch(`${config.ollamaHost}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: conversation,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.status}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    return {
      text: data.message.content,
      totalInputTokens: data.prompt_eval_count ?? 0,
      totalOutputTokens: data.eval_count ?? 0,
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

    const conversation = [
      ...(systemPrompt
        ? [
            {
              role: "system" as const,
              content: systemPrompt,
            },
          ]
        : []),
      ...this.buildMessages(prompt, messages),
    ];

    const response = await fetch(`${config.ollamaHost}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: conversation,
        stream: true,
      }),
    });

    if (!response.body) {
      throw new Error("No se recibió stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let finalChunk: OllamaGenerateResponse | undefined;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value);

      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        const data = JSON.parse(line) as OllamaGenerateResponse;

        finalChunk = data;

        const text = data.message?.content ?? "";

        if (text) {
          process.stdout.write(text);

          fullResponse += text;
        }
      }
    }

    process.stdout.write("\n");

    return {
      text: fullResponse,
      totalInputTokens: finalChunk?.prompt_eval_count ?? 0,
      totalOutputTokens: finalChunk?.eval_count ?? 0,
    };
  }
}
