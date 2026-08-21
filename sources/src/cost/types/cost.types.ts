/**
 * Configuración utilizada para limitar
 * las llamadas realizadas a proveedores LLM.
 */
export interface LlmUsageLimiterOptions {
  /** Máximo de llamadas permitidas dentro de la ventana. */
  maxRequests: number;

  /** Duración de la ventana en milisegundos. */
  windowMs: number;
}

export interface LlmUsage {
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Estado actual del límite de llamadas LLM.
 */
export interface LlmUsageLimitStats {
  // Llamadas realizadas dentro de la ventana activa.
  used: number;

  // Llamadas disponibles dentro de la ventana activa.
  remaining: number;

  // Máximo de llamadas permitidas.
  maxRequests: number;

  // Duración de la ventana configurada.
  windowMs: number;

  // Tiempo restante hasta que pueda liberarse una llamada.
  retryAfterMs: number;
}

/**
 * Consumo registrado con su costo estimado.
 */
export interface LlmUsageCost extends LlmUsage {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/**
 * Consumo acumulado durante toda la sesión.
 */
export interface LlmUsageSummary {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
}
