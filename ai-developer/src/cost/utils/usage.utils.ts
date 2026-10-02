import {
  getLlmUsageLimiter,
  getLlmUsageTracker,
} from "../../llm/llm.instances.js";

/**
 * Convierte milisegundos en minutos y segundos.
 *
 * @param milliseconds Tiempo expresado en milisegundos.
 * @return Tiempo legible.
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes} min ${seconds} s`;
  }

  return `${seconds} s`;
}

/**
 * Convierte una ventana expresada en milisegundos
 * a un formato legible para la consola.
 *
 * @param windowMs Duración de la ventana en milisegundos.
 * @return Duración formateada.
 */
export function formatWindow(windowMs: number): string {
  const seconds = windowMs / 1000;

  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;

    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }

  return `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
}

/**
 * Muestra el estado actual de requests, tokens y costos
 * acumulados durante la sesión.
 */
export function printLlmUsage(): void {
  const limit = getLlmUsageLimiter().getStats();
  const tracker = getLlmUsageTracker();

  const summary = tracker.getSummary();
  const models = tracker.getSummaryByModel();

  console.log("");
  console.log("📊 Requests");
  console.log(`   • Requests sesión: ${summary.requests}`);
  console.log(
    `   • Requests últimos ${formatWindow(limit.windowMs)}: ${limit.used}`,
  );
  console.log(`   • Requests disponibles: ${limit.remaining}`);

  if (limit.remaining === 0 && limit.retryAfterMs > 0) {
    console.log(
      `   • Próxima request disponible en: ` +
        `${formatDuration(limit.retryAfterMs)}`,
    );
  }

  console.log("");
  console.log("🧠 Consumo acumulado");
  console.log(`   • Tokens entrada: ${summary.inputTokens}`);
  console.log(`   • Tokens salida: ${summary.outputTokens}`);
  console.log(`   • Tokens totales: ${summary.totalTokens}`);

  console.log("");
  console.log("💰 Costo estimado");
  console.log(`   • Total sesión: $${summary.totalCost.toFixed(6)} USD`);

  if (models.length > 0) {
    console.log("");
    console.log("🤖 Consumo por modelo");

    for (const usage of models) {
      console.log(`   • ${usage.provider} / ${usage.model}`);
      console.log(`     Requests sesión: ${usage.requests}`);
      console.log(
        `     Tokens: ${usage.inputTokens} entrada / ` +
          `${usage.outputTokens} salida`,
      );
      console.log(`     Costo: $${usage.totalCost.toFixed(6)} USD`);
    }
  }

  console.log("");
}

/**
 * Obtiene el consumo acumulado durante la sesión.
 */
export function getSessionUsage() {
  const usages = getLlmUsageTracker().getAll();

  return usages.reduce(
    (total, usage) => ({
      requests: total.requests + usage.requests,
      inputTokens: total.inputTokens + usage.inputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
    }),
    {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  );
}

/**
 * Valida si existen suficientes requests disponibles
 * para ejecutar un laboratorio.
 *
 * @param requiredRequests Número de requests que requiere el laboratorio.
 * @return true si existen requests suficientes; false en caso contrario.
 */
export function hasAvailableLlmRequests(requiredRequests: number): boolean {
  const stats = getLlmUsageLimiter().getStats();

  if (requiredRequests <= stats.remaining) {
    return true;
  }

  console.log("");
  console.log("⚠️ Requests insuficientes para ejecutar el laboratorio.");
  console.log(`   • Requeridas: ${requiredRequests}`);
  console.log(`   • Disponibles: ${stats.remaining}`);

  if (stats.retryAfterMs > 0) {
    console.log(
      `   • Próxima request disponible en: ${formatDuration(
        stats.retryAfterMs,
      )}`,
    );
  }

  console.log("");

  return false;
}
