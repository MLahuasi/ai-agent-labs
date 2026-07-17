import Anthropic from "@anthropic-ai/sdk";

import config from "../../config/index.js";

import { Message } from "../../types/index.js";
import { AskResponse, LlmClient } from "../interfaces/index.js";

/**
 * Implementacion del cliente Anthropic.
 *
 * Esta clase adapta el SDK de Anthropic
 * al contrato definido por la interfaz LlmClient.
 *
 * Gracias a esto, el resto de la aplicacion
 * no necesita conocer detalles especificos
 * de Anthropic.
 */
export class AnthropicClient implements LlmClient {
  /**
   * Instancia privada del SDK oficial.
   */
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Construye la lista de mensajes esperada
   * por Anthropic.
   *
   * Los mensajes con rol "system" se excluyen
   * porque Anthropic recibe las instrucciones
   * de sistema mediante la propiedad "system"
   * y no dentro del historial.
   *
   * Si no se recibe historial, se construye
   * un unico mensaje utilizando el prompt.
   */
  private buildMessages(prompt: string, messages?: Message[]) {
    const conversation = messages?.length
      ? messages.filter((m) => m.role !== "system")
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
   * Espera a que Claude termine la generacion
   * antes de retornar el resultado.
   */
  async ask(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    const response = await this.client.messages.create({
      model: config.anthropicModel,
      max_tokens: config.max_tokens,
      ...(systemPrompt && {
        system: systemPrompt,
      }),
      messages: this.buildMessages(prompt, messages),
    });

    // console.log("stop_reason:", response.stop_reason);
    // console.log("usage:", response.usage);

    const textBlock = response.content.find((block) => block.type === "text");

    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude no retorno un bloque de texto en la respuesta");
    }

    return {
      text: textBlock.text,
      totalInputTokens: response.usage.input_tokens,
      totalOutputTokens: response.usage.output_tokens,
    };
  }

  /**
   * Genera una respuesta utilizando streaming.
   *
   * Mientras Claude genera contenido,
   * este se imprime en consola y se acumula
   * en la variable fullResponse.
   */
  async stream(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    let fullResponse = "";

    const responseStream = this.client.messages.stream({
      model: config.anthropicModel,
      max_tokens: config.max_tokens,
      ...(systemPrompt && {
        system: systemPrompt,
      }),
      messages: this.buildMessages(prompt, messages),
    });

    /**
     * Se ejecuta cada vez que Claude
     * genera un nuevo fragmento de texto.
     */
    responseStream.on("text", (chunk) => {
      process.stdout.write(chunk);

      fullResponse += chunk;
    });

    /**
     * Espera a que termine completamente
     * la generacion del mensaje.
     */
    const finalMessage = await responseStream.finalMessage();

    /**
     * Salto de linea para mejorar
     * la visualizacion en consola.
     */
    process.stdout.write("\n");

    // return fullResponse;
    return {
      text: fullResponse,
      totalInputTokens: finalMessage.usage.input_tokens,
      totalOutputTokens: finalMessage.usage.output_tokens,
    };
  }
}
