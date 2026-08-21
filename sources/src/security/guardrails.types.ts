/**
 * Resultado obtenido después de aplicar una validación
 * o regla de seguridad sobre una entrada.
 */
export interface GuardrailResult {
  /** Indica si el contenido fue considerado seguro. */
  safe: boolean;

  /** Motivo por el cual el contenido fue rechazado o modificado. */
  reason?: string;

  /** Contenido resultante después de aplicar las reglas de seguridad. */
  sanitized: string;
}

/**
 * Configuración utilizada para limitar la cantidad
 * de solicitudes permitidas dentro de un intervalo de tiempo.
 */
export interface RateLimiterConfig {
  /** Número máximo de solicitudes permitidas dentro de la ventana de tiempo. */
  maxRequest: number;

  /** Duración de la ventana de tiempo en milisegundos. */
  windowMs: number;
}

/**
 * Configuración utilizada por el servicio de guardrails.
 *
 * Define los límites aplicados a las solicitudes y
 * al contenido recibido antes de enviarlo al agente o al LLM.
 */
export interface GuardrailsConfig {
  /** Longitud máxima permitida para la entrada del usuario, en caracteres. */
  maxInputLength: number;

  /** Configuración utilizada para limitar la frecuencia de solicitudes recibidas. */
  rateLimit: RateLimiterConfig;
}
