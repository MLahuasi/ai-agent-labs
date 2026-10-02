import { ToolCall } from "../index.js";
import { Role } from "./index.js";

/**
 * Representa un mensaje dentro de la conversación
 * intercambiada entre el usuario, el asistente o una herramienta.
 */
export interface Message {
  /**
   * Rol del emisor del mensaje.
   *
   * Valores típicos:
   * - "user": mensaje del usuario
   * - "assistant": respuesta del modelo
   */
  role: Role;

  /**
   * Contenido textual del mensaje.
   *
   * Puede contener una pregunta, instrucción, respuesta
   * o el resultado devuelto por una herramienta.
   */
  content: string;

  /**
   * Llamadas solicitadas por el asistente.
   * Solo aplica normalmente a role === "assistant".
   */
  toolCalls?: ToolCall[];

  /**
   * ID de la llamada cuyo resultado contiene este mensaje.
   * Aplica a role === "tool".
   *
   * Ejemplo: "call_abc123"
   */
  toolCallId?: string;

  /**
   * Nombre lógico de la herramienta.
   * No sustituye a toolCallId.
   */
  toolName?: string;
}
