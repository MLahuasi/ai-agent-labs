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
  | "system"
  /**
   * Se usa en algunos modelos
   */
  | "tool";
