import { Message } from "../chat/message.js";

/**
 * Representa la respuesta generada por el agente.
 */
export interface AgentResponse {
  /**
   * Texto generado como respuesta al usuario.
   */
  text: string;

  /**
   * Cantidad total de tokens consumidos por la entrada.
   */
  totalInputTokens: number;

  /**
   * Cantidad total de tokens generados en la salida.
   */
  totalOutputTokens: number;

  /**
   * Lista de herramientas utilizadas durante la ejecución.
   */
  toolsUsed: string[];

  /**
   * Cantidad de llamadas a herramientas realizadas en el último turno.
   */
  toolCallsLastTurn: number;

  /**
   * Historial opcional de mensajes de la conversación.
   */
  conversation?: Message[];
}
