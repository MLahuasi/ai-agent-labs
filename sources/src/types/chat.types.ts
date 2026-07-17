/**
 * Roles permitidos dentro de la conversación.
 *
 * Cada rol identifica quién genera el mensaje y ayuda al modelo
 * a interpretar correctamente el contexto del diálogo.
 */
export type Role =
  /**
   * Mensaje enviado por el usuario.
   * Contiene preguntas, instrucciones o solicitudes.
   */
  | "user"

  /**
   * Mensaje generado por el asistente.
   * Contiene respuestas, explicaciones o resultados procesados.
   */
  | "assistant"
  /**
   * Mensaje generado por el sistema.
   */
  | "system";

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
}
