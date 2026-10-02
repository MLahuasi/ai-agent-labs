import { PRICING } from "../data/pricings.js";
import {
  LlmUsage,
  LlmUsageCost,
  LlmUsageSummary,
} from "../types/cost.types.js";

export class LlmUsageTrackerService {
  private readonly usages: LlmUsage[] = [];

  /**
   * Registra el consumo completo de una ejecución.
   *
   * @param usage Métricas generadas por el cliente.
   * @return No retorna ningún valor.
   */
  record(usage: LlmUsage): void {
    this.usages.push(usage);
  }

  /**
   * Obtiene todos los consumos registrados.
   *
   * @return Consumos registrados durante la sesión.
   */
  getAll(): LlmUsage[] {
    return [...this.usages];
  }

  /**
   * Calcula el costo correspondiente a un consumo registrado.
   *
   * Los precios están expresados en USD por 1 millón de tokens.
   *
   * @param usage Consumo registrado.
   * @return Consumo con costos calculados.
   */
  private calculateCost(usage: LlmUsage): LlmUsageCost {
    const pricing = PRICING[usage.model];

    // Si el modelo no está configurado en la tabla de precios,
    // no se puede determinar su costo.
    if (!pricing) {
      return {
        ...usage,
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
      };
    }

    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;

    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;

    return {
      ...usage,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  }

  /**
   * Obtiene todos los consumos incluyendo
   * el costo estimado por proveedor y modelo.
   *
   * @return Consumos con costos calculados.
   */
  getAllWithCost(): LlmUsageCost[] {
    return this.usages.map((usage) => this.calculateCost(usage));
  }

  /**
   * Obtiene el consumo total registrado durante la sesión.
   *
   * @return Resumen acumulado de requests y tokens.
   */
  getSummary(): LlmUsageSummary {
    const usages = this.getAllWithCost();
    const summary = usages.reduce(
      (total, usage) => ({
        requests: total.requests + usage.requests,
        inputTokens: total.inputTokens + usage.inputTokens,
        outputTokens: total.outputTokens + usage.outputTokens,
        totalCost: total.totalCost + usage.totalCost,
      }),
      {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
      },
    );

    return {
      ...summary,
      totalTokens: summary.inputTokens + summary.outputTokens,
    };
  }

  /**
   * Obtiene el consumo agrupado por proveedor y modelo.
   *
   * @return Consumo consolidado por proveedor/modelo.
   */
  getSummaryByModel(): LlmUsageCost[] {
    const grouped = new Map<string, LlmUsage>();

    for (const usage of this.usages) {
      const key = `${usage.provider}:${usage.model}`;

      const current = grouped.get(key);

      if (!current) {
        grouped.set(key, { ...usage });
        continue;
      }

      current.requests += usage.requests;
      current.inputTokens += usage.inputTokens;
      current.outputTokens += usage.outputTokens;
    }

    return [...grouped.values()].map((usage) => this.calculateCost(usage));
  }
}
