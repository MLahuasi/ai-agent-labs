import type { Interface } from "node:readline/promises";

import { LlmClient } from "../../../types/app/index.js";
import { SelectModelService } from "../services/select-model.service.js";
import { SelectableModel } from "../types/select-model.types.js";
import { GuardrailsService } from "../../../security/guardrails.service.js";
import { hasAvailableLlmRequests, printLlmUsage } from "../../../cost/index.js";

/**
 * Ejecuta el caso de uso de selección dinámica de modelos.
 *
 * Cada solicitud es clasificada y enviada automáticamente
 * al modelo configurado para esa categoría.
 *
 * La sesión finaliza cuando el usuario utiliza /exit.
 *
 * @param rl Interfaz de consola compartida con el menú principal.
 * @param routerClient Cliente utilizado para clasificar solicitudes.
 * @param models Modelos disponibles para resolverlas.
 * @return No retorna ningún valor.
 */
export async function selectModelUseCase(
  rl: Interface,
  routerClient: LlmClient,
  models: SelectableModel[],
  guardrails: GuardrailsService,
): Promise<void> {
  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(2)) {
    return;
  }
  console.log("");
  console.log("╔════════════════════════════════╗");
  console.log("║   Selección Dinámica de LLMs   ║");
  console.log("╚════════════════════════════════╝");
  console.log("");
  console.log("💡 Escribe una pregunta y el sistema seleccionará el modelo.");
  console.log("   Comandos: /usage, /exit");
  console.log("💡 Escribe /exit para volver al menú.");
  console.log("");

  // Crear el servicio utilizado durante toda la sesión.
  const service = SelectModelService.create(routerClient, models);

  while (true) {
    const message = (await rl.question("Tú: ")).trim();

    if (!message) {
      continue;
    }

    if (message === "/usage") {
      printLlmUsage();
      continue;
    }

    if (message === "/exit" || message === "/salida") {
      return;
    }

    // Validar el prompt antes de enviarlo al LLM.
    const guardrailResult = guardrails.checkInput(message);

    if (!guardrailResult.safe) {
      guardrails.printResult("", message, guardrailResult);
      continue;
    }

    try {
      console.log("");
      console.log("🔀 Seleccionando modelo...");

      const result = await service.ask(guardrailResult.sanitized);

      console.log(`✅ Categoría: ${result.task}`);

      console.log(`🤖 Modelo: ${result.provider} / ${result.model}`);

      console.log("");
      console.log(result.answer);
      console.log("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";

      console.log(`\n❌ Error: ${message}\n`);
    }
  }
}
