/**
 * Respuesta generada por el agente de IA.
 */
export interface AgentResponse {
  /** Texto generado como respuesta al usuario. */
  text: string;

  /** Lista de herramientas utilizadas durante la generación de la respuesta. */
  toolsUsed: string[];

  /** Cantidad de tokens consumidos por la entrada (prompt). */
  inputTokens: number;

  /** Cantidad de tokens generados en la salida (respuesta). */
  outputTokens: number;
}
