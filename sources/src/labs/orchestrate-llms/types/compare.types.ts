import { LlmClient } from "../../../types/app/index.js";

/**
 * Representa un modelo participante dentro de la comparación.
 */
export type Competitor = {
  provider: string;
  model: string;
  client: LlmClient;
};

/**
 * Representa la respuesta obtenida desde un modelo participante.
 */
export type ModelAnswer = {
  provider: string;
  model: string;
  answer: string;
  totalInputTokens: number;
  totalOutputTokens: number;
};

/**
 * Representa la estructura JSON esperada desde el modelo juez.
 */
export type JudgeResponse = {
  resultados: number[];
};
