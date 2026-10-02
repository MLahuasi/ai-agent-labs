import type { Message as OllamaMessage } from "ollama";
import type {
  ToolCall,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

/**
 * Representa una llamada a herramienta generada por el modelo.
 */
export interface ModelToolCall extends ToolCall {
  // Identificador interno de la llamada.
  id: string;
}

/**
 * Representa una llamada a herramienta recibida desde Ollama.
 */
export interface OllamaToolCall {
  // Datos de la función solicitada.
  function: {
    // Nombre de la herramienta solicitada.
    name?: string;

    // Argumentos enviados a la herramienta.
    arguments?: unknown;
  };
}

/**
 * Representa el resultado de una herramienta ejecutada.
 */
export interface ExecutedToolResult {
  // Nombre de la herramienta ejecutada.
  name: string;

  // Resultado generado por la herramienta.
  output: string;
}

/**
 * Mantiene el estado compartido durante la ejecución.
 */
export interface ExecutionContext {
  // Historial enviado a Ollama.
  conversation: OllamaMessage[];

  // Total acumulado de tokens de entrada.
  totalInputTokens: number;

  // Total acumulado de tokens de salida.
  totalOutputTokens: number;

  // Estado actual de ejecución de herramientas.
  toolState: ToolExecutionState;
}

/**
 * Mantiene el resultado acumulado de una iteración de streaming.
 */
export interface StreamIterationResult {
  // Texto generado durante la iteración.
  text: string;

  // Mensaje generado durante la iteración.
  assistantMessage: OllamaMessage;

  // Llamadas a herramientas encontradas.
  toolCalls: OllamaToolCall[];

  // Tokens de entrada utilizados.
  inputTokens: number;

  // Tokens de salida utilizados.
  outputTokens: number;
}
