import Anthropic from "@anthropic-ai/sdk";
import type {
  ToolCall,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

/**
 * Representa una llamada a herramienta generada por el modelo.
 */
export interface ModelToolCall extends ToolCall {
  // Identificador de la llamada generado por Anthropic.
  id: string;
}

/**
 * Representa una llamada a herramienta recibida desde Anthropic.
 */
export interface AnthropicToolCall {
  // Identificador de la llamada.
  id: string;

  // Nombre de la herramienta solicitada.
  name: string;

  // Argumentos enviados a la herramienta.
  input: unknown;
}

/**
 * Representa el resultado de una herramienta ejecutada.
 */
export interface ExecutedToolResult {
  // Identificador de la llamada asociada al resultado.
  callId: string;

  // Nombre de la herramienta ejecutada.
  name: string;

  // Resultado generado por la herramienta.
  output: string;

  // Indica si el resultado contiene un error.
  isError: boolean;
}

/**
 * Mantiene el estado compartido durante la ejecución.
 */
export interface ExecutionContext {
  // Historial enviado a Anthropic.
  messages: Anthropic.Messages.MessageParam[];

  // Total acumulado de tokens de entrada.
  totalInputTokens: number;

  // Total acumulado de tokens de salida.
  totalOutputTokens: number;

  // Estado actual de ejecución de herramientas.
  toolState: ToolExecutionState;
}
