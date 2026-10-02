import OpenAI from "openai";
import type {
  ToolCall,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

/**
 * Representa una llamada a herramienta generada por el modelo.
 */
export interface ModelToolCall extends ToolCall {
  // Identificador de la llamada generado por OpenAI.
  id: string;
}

/**
 * Representa una llamada a herramienta recibida desde OpenAI.
 */
export interface OpenAiToolCall {
  // Identificador de la llamada.
  call_id: string;

  // Nombre de la herramienta solicitada.
  name: string;

  // Argumentos enviados a la herramienta.
  arguments: string;
}

/**
 * Representa el resultado de una herramienta ejecutada.
 */
export interface ExecutedToolResult {
  // Identificador de la llamada asociada al resultado.
  callId: string;

  // Resultado generado por la herramienta.
  output: string;
}

/**
 * Mantiene el estado compartido durante la ejecución.
 */
export interface ExecutionContext {
  // Historial enviado a OpenAI Responses API.
  input: OpenAI.Responses.ResponseInput;

  // Total acumulado de tokens de entrada.
  totalInputTokens: number;

  // Total acumulado de tokens de salida.
  totalOutputTokens: number;

  // Estado actual de ejecución de herramientas.
  toolState: ToolExecutionState;
}
