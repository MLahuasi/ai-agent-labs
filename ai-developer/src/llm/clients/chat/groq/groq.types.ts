import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import type {
  ToolCall,
  ToolExecutionState,
} from "../../../../types/agent/index.js";

/**
 * Representa una llamada a herramienta generada por el modelo.
 */
export interface ModelToolCall extends ToolCall {
  // Identificador de la llamada generado por Groq.
  id: string;
}

/**
 * Representa una llamada a herramienta recibida desde Groq.
 */
export interface GroqToolCall {
  // Identificador de la llamada.
  id: string;

  // Datos de la función solicitada.
  function: {
    // Nombre de la herramienta solicitada.
    name?: string;

    // Argumentos enviados a la herramienta.
    arguments: string;
  };
}

/**
 * Representa el resultado de una herramienta ejecutada.
 */
export interface ExecutedToolResult {
  // Identificador de la llamada asociada al resultado.
  id: string;

  // Resultado generado por la herramienta.
  output: string;
}

/**
 * Mantiene el estado compartido durante la ejecución.
 */
export interface ExecutionContext {
  // Historial enviado a Groq.
  conversation: ChatCompletionMessageParam[];

  // Total acumulado de tokens de entrada.
  totalInputTokens: number;

  // Total acumulado de tokens de salida.
  totalOutputTokens: number;

  // Estado actual de ejecución de herramientas.
  toolState: ToolExecutionState;
}

/**
 * Mantiene los fragmentos de una llamada recibida mediante streaming.
 */
export interface StreamToolCall {
  // Identificador de la llamada.
  id?: string;

  // Nombre de la herramienta solicitada.
  name?: string;

  // Argumentos acumulados durante el streaming.
  arguments: string;
}
