import { Message } from "../../types/index.js";

export interface AskResponse {
  text: string;
  totalInputTokens: number;
  totalOutputTokens: number;
}
/**
 * Contrato que debe implementar cualquier cliente LLM.
 *
 * Permite intercambiar proveedores sin modificar
 * el resto de la aplicacion.
 */
export interface LlmClient {
  /**
   * Genera una respuesta completa y la retorna
   * una vez finalizada.
   */
  ask(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse>;

  /**
   * Genera una respuesta en modo streaming.
   *
   * Va entregando contenido en tiempo real y
   * retorna la respuesta completa al finalizar.
   */
  stream(
    prompt: string,
    systemPrompt?: string,
    messages?: Message[],
  ): Promise<AskResponse>;
}
