import type { Content } from "@google/genai";

import type {
  ToolCall,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

/**
 * Representa una llamada a herramienta generada por el modelo.
 */
export interface ModelToolCall extends ToolCall {
  // Nombre de la herramienta solicitada.
  name: string;
}

/**
 * Representa una llamada a herramienta recibida desde Gemini.
 */
export interface GeminiToolCall {
  // Identificador opcional de la llamada.
  id?: string;

  // Nombre de la herramienta solicitada.
  name?: string;

  // Argumentos enviados a la herramienta.
  args?: unknown;
}

/**
 * Representa el resultado de una herramienta ejecutada.
 */
export interface ExecutedToolResult {
  // Identificador opcional de la llamada asociada al resultado.
  callId?: string;

  // Nombre de la herramienta ejecutada.
  name: string;

  // Resultado generado por la herramienta.
  output: string;
}

/**
 * Mantiene el estado compartido durante la ejecución.
 */
export interface ExecutionContext {
  // Historial enviado a Gemini.
  contents: Content[];

  // Total acumulado de tokens de entrada.
  totalInputTokens: number;

  // Total acumulado de tokens de salida.
  totalOutputTokens: number;

  // Estado actual de ejecución de herramientas.
  toolState: ToolExecutionState;
}
