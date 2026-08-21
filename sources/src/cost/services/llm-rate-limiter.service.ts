import {
  LlmUsageLimiterOptions,
  LlmUsageLimitStats,
} from "../types/cost.types.js";

/**
 * Controla la cantidad de llamadas reales realizadas
 * a proveedores LLM dentro de una ventana de tiempo.
 */
export class LlmUsageLimiterService {
  /** Timestamps de las llamadas realizadas dentro de la ventana activa. */
  private requestTimestamps: number[] = [];

  constructor(private readonly options: LlmUsageLimiterOptions) {}

  /**
   * Valida y registra una llamada al proveedor LLM.
   *
   * Debe ejecutarse inmediatamente antes
   * de realizar la llamada real al proveedor.
   *
   * @throws Error cuando se alcanza el límite configurado.
   * @return No retorna ningún valor.
   */
  consume(): void {
    const now = Date.now();

    // 1. Eliminar llamadas que ya están fuera de la ventana.
    this.removeExpiredRequests(now);

    // 2. Verificar si se alcanzó el máximo permitido.
    if (this.requestTimestamps.length >= this.options.maxRequests) {
      throw new Error(
        `Límite de llamadas LLM alcanzado. ` +
          `Máximo ${this.options.maxRequests} llamadas cada ` +
          `${this.options.windowMs} ms.`,
      );
    }

    // 3. Registrar la llamada que está por realizarse.
    this.requestTimestamps.push(now);
  }

  /**
   * Elimina las llamadas que ya no pertenecen
   * a la ventana de tiempo activa.
   */
  private removeExpiredRequests(now: number): void {
    const windowStart = now - this.options.windowMs;

    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > windowStart,
    );
  }

  /**
   * Obtiene el estado actual de la ventana de llamadas LLM.
   *
   * @return Estadísticas correspondientes a la ventana activa.
   */
  getStats(): LlmUsageLimitStats {
    const now = Date.now();

    // Eliminar llamadas que ya no pertenecen a la ventana activa.
    this.removeExpiredRequests(now);

    const used = this.requestTimestamps.length;

    const remaining = Math.max(this.options.maxRequests - used, 0);

    let retryAfterMs = 0;

    // Cuando no quedan llamadas disponibles, calcular
    // cuánto falta para que expire la llamada más antigua.
    if (remaining === 0 && this.requestTimestamps.length > 0) {
      const oldestRequest = this.requestTimestamps[0];

      if (oldestRequest !== undefined) {
        retryAfterMs = Math.max(oldestRequest + this.options.windowMs - now, 0);
      }
    }

    return {
      used,
      remaining: Math.max(this.options.maxRequests - used, 0),
      maxRequests: this.options.maxRequests,
      windowMs: this.options.windowMs,
      retryAfterMs,
    };
  }
}
