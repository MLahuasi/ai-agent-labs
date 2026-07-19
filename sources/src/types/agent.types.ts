/**
 * Respuesta generada por el agente de IA.
 */
export interface AskResponse {
  /** Texto generado como respuesta al usuario. */
  text: string;
  /** Cantidad de tokens consumidos por la entrada (prompt). */
  totalInputTokens: number;
  /** Cantidad de tokens generados en la salida (respuesta). */
  totalOutputTokens: number;
  /** Lista de herramientas utilizadas durante la generación de la respuesta. */
  toolsUsed?: string[];
}
