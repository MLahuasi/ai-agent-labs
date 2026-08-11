import { ToolError } from "./tool.types.js";

/**
 * Representa un error durante la ejecución de una herramienta.
 */
export interface ToolExecutionError extends ToolError {
  // Mensaje del error.
  message: string;

  // Datos requeridos que no fueron proporcionados.
  missing?: string[];
}

/**
 * Mantiene el estado de ejecución de las herramientas.
 */
export interface ToolExecutionState {
  // Herramientas ejecutadas correctamente.
  toolsUsed: Set<string>;

  // Llamadas ya ejecutadas durante el flujo actual.
  executedToolCalls: Set<string>;
}
