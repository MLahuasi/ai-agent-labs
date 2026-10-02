import { LlmClient } from "../../../types/app/index.js";

/**
 * Categorías utilizadas para seleccionar
 * el modelo responsable de una solicitud.
 */
export type ModelTask = "general" | "code" | "reasoning";

/**
 * Representa un modelo disponible
 * para una categoría determinada.
 */
export type SelectableModel = {
  task: ModelTask;
  provider: string;
  model: string;
  client: LlmClient;
};

/**
 * Resultado generado después de seleccionar
 * y ejecutar el modelo correspondiente.
 */
export type ModelSelectionResult = {
  task: ModelTask;
  provider: string;
  model: string;
  answer: string;
};
