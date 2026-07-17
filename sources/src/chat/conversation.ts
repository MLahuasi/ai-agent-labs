import { AskResponse } from "../llm/interfaces/index.js";
import { Message } from "../types/chat.types.js";

/**
 * Estimacion aproximada utilizada para calcular
 * el numero de tokens consumidos.
 *
 * Regla empirica:
 * 1 token ~= 4 caracteres.
 */
// const CHAR_PER_TOKEN = 4;

/**
 * Firma esperada de cualquier funcion que
 * pueda enviar prompts a un LLM.
 */
export type AskFunction = (
  prompt: string,
  systemPrompt?: string,
  messages?: Message[],
) => Promise<AskResponse>;

/**
 * Gestiona una conversacion con un LLM.
 *
 * Mantiene el historial completo de mensajes
 * y lo envia en cada interaccion para conservar
 * el contexto de la conversacion.
 */
export class Conversation {
  /**
   * Historial completo de la conversacion.
   */
  private messages: Message[] = [];

  /**
   * Prompt de sistema utilizado durante toda
   * la conversacion.
   */
  private readonly systemPrompt: string;

  /**
   * Funcion responsable de comunicarse con el LLM.
   */
  private readonly askFn: AskFunction;

  /**
   * Total aproximado de tokens enviados al modelo.
   */
  private totalInputTokens = 0;

  /**
   * Total aproximado de tokens generados por el modelo.
   */
  private totalOutputTokens = 0;

  constructor(askFn: AskFunction, systemPrompt: string = "") {
    this.askFn = askFn;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Agrega un mensaje del usuario al historial.
   */
  addUserMessage(text: string): void {
    this.messages.push({
      role: "user",
      content: text,
    });

    // this.totalInputsTokens += Math.ceil(text.length / CHAR_PER_TOKEN);
  }

  /**
   * Agrega un mensaje generado por el asistente
   * al historial.
   */
  addAssistantMessage(text: string): void {
    this.messages.push({
      role: "assistant",
      content: text,
    });
  }

  /**
   * Envía todo el historial al modelo y almacena
   * automaticamente la respuesta obtenida.
   *
   * @returns Respuesta generada por el LLM.
   */
  async send(prompt: string): Promise<string> {
    const response = await this.askFn(prompt, this.systemPrompt, this.messages);

    this.addAssistantMessage(response.text);
    this.totalInputTokens += response.totalInputTokens;
    this.totalOutputTokens += response.totalOutputTokens;

    return response.text;
  }

  /**
   * Devuelve una copia del historial.
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Devuelve la cantidad aproximada de tokens
   * enviados al modelo.
   */
  getTotalInputTokens(): number {
    return this.totalInputTokens;
  }

  /**
   * Devuelve la cantidad aproximada de tokens
   * generados por el modelo.
   */
  getTotalOutputTokens(): number {
    return this.totalOutputTokens;
  }
}
