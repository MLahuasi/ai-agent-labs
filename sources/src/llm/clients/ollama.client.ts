import { config } from "../../config/index.js";
import {
  AskResponse,
  LlmClient,
  Message,
  OllamaGenerateResponse,
} from "../../types/index.js";

/**
 * Adaptador para utilizar modelos locales mediante la API HTTP de Ollama.
 *
 * Implementa el contrato LlmClient para que Ollama pueda intercambiarse
 * por otros proveedores sin modificar la conversación ni la CLI.
 */
export class OllamaClient implements LlmClient {
  /**
   * Construye el historial que se enviará a Ollama.
   *
   * Responsabilidades:
   * - Copiar los mensajes para no modificar el historial original.
   * - Eliminar mensajes system existentes para evitar duplicados.
   * - Agregar el prompt actual cuando todavía no está en el historial.
   * - Enviar el systemPrompt como mensaje system.
   * - Repetir las instrucciones junto al último mensaje del usuario.
   *
   * El refuerzo del systemPrompt es útil con modelos locales pequeños,
   * que pueden ignorar instrucciones alejadas de la pregunta actual.
   */
  private buildConversation(
    prompt: string,
    systemPrompt?: string,
    messages: Message[] = [],
  ): Message[] {
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ ...message }));

    const lastMessage = conversation.at(-1);

    const promptAlreadyIncluded =
      lastMessage?.role === "user" && lastMessage.content === prompt;

    if (!promptAlreadyIncluded) {
      conversation.push({
        role: "user",
        content: prompt,
      });
    }

    if (!systemPrompt) {
      return conversation;
    }

    const currentUserMessage = conversation.at(-1);

    if (currentUserMessage?.role === "user") {
      currentUserMessage.content = [
        "<system_instructions>",
        systemPrompt,
        "</system_instructions>",
        "",
        "<current_user_request>",
        currentUserMessage.content,
        "</current_user_request>",
        "",
        "Responde respetando estrictamente las instrucciones anteriores.",
      ].join("\n");
    }

    return [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversation,
    ];
  }

  /**
   * Extrae el mensaje enviado por Ollama cuando una petición HTTP falla.
   *
   * Si la respuesta no contiene JSON válido, utiliza el texto asociado
   * al código HTTP.
   */
  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as {
        error?: string;
      };

      return data.error ?? response.statusText;
    } catch {
      return response.statusText;
    }
  }

  /**
   * Envía una petición común a Ollama.
   *
   * Se utiliza tanto para respuestas completas como para streaming,
   * cambiando únicamente el valor de stream.
   */
  private request(conversation: Message[], stream: boolean): Promise<Response> {
    return fetch(`${config.ollamaHost}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: conversation,
        stream,
        options: {
          /**
           * Reduce la variabilidad para que el modelo siga
           * las instrucciones de manera más consistente.
           */
          temperature: 0,
          top_k: 20,
          top_p: 0.8,
          repeat_penalty: 1.1,

          /**
           * Limita la cantidad máxima de tokens generados.
           */
          num_predict: config.max_tokens,

          /**
           * Permite obtener resultados reproducibles cuando
           * se utilizan los mismos mensajes y parámetros.
           */
          seed: 42,
        },
      }),
    });
  }

  /**
   * Genera una respuesta completa.
   *
   * Ollama espera hasta terminar la generación y devuelve
   * un único objeto JSON con el texto y las métricas de uso.
   */
  async ask(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    const conversation = this.buildConversation(prompt, systemPrompt, messages);

    const response = await this.request(conversation, false);

    if (!response.ok) {
      const message = await this.getErrorMessage(response);

      throw new Error(`Ollama Error ${response.status}: ${message}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    const text = data.message?.content?.trim();

    if (!text) {
      throw new Error("Ollama no retornó contenido de texto");
    }

    return {
      text,
      totalInputTokens: data.prompt_eval_count ?? 0,
      totalOutputTokens: data.eval_count ?? 0,
    };
  }

  /**
   * Genera una respuesta incremental.
   *
   * Ollama envía una secuencia NDJSON:
   * cada línea contiene un objeto JSON con un fragmento de texto.
   *
   * Los fragmentos se imprimen inmediatamente y también se acumulan
   * para devolver la respuesta completa al finalizar.
   */
  async stream(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse> {
    const conversation = this.buildConversation(prompt, systemPrompt, messages);

    const response = await this.request(conversation, true);

    if (!response.ok) {
      const message = await this.getErrorMessage(response);

      throw new Error(`Ollama Error ${response.status}: ${message}`);
    }

    if (!response.body) {
      throw new Error("Ollama no retornó un stream de respuesta");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let fullResponse = "";
    let finalChunk: OllamaGenerateResponse | undefined;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      /**
       * Un bloque recibido desde la red puede contener:
       * - varias líneas JSON completas;
       * - una sola línea completa;
       * - una parte incompleta de una línea.
       *
       * El buffer conserva la parte incompleta hasta recibir
       * el siguiente bloque.
       */
      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      /**
       * El último elemento puede ser un JSON incompleto,
       * por lo que no se procesa todavía.
       */
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          continue;
        }

        const data = JSON.parse(trimmedLine) as OllamaGenerateResponse;

        finalChunk = data;

        const text = data.message?.content ?? "";

        if (text) {
          fullResponse += text;
          process.stdout.write(text);
        }
      }
    }

    /**
     * Finaliza la decodificación UTF-8 y procesa cualquier
     * línea que haya quedado pendiente al cerrar el stream.
     */
    buffer += decoder.decode();

    if (buffer.trim()) {
      const data = JSON.parse(buffer.trim()) as OllamaGenerateResponse;

      finalChunk = data;

      const text = data.message?.content ?? "";

      if (text) {
        fullResponse += text;
        process.stdout.write(text);
      }
    }

    process.stdout.write("\n");

    if (!fullResponse.trim()) {
      throw new Error("Ollama no retornó contenido de texto");
    }

    return {
      text: fullResponse,
      totalInputTokens: finalChunk?.prompt_eval_count ?? 0,
      totalOutputTokens: finalChunk?.eval_count ?? 0,
    };
  }
}
