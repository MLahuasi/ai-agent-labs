import type { Interface } from "node:readline/promises";
import { LlmClient } from "../../../types/app/index.js";
import { GREETING_MESSAGE } from "../prompts/evaluator.prompts.js";
import { EvaluatorService } from "../services/evaluator.service.js";
import { GuardrailsService } from "../../../security/guardrails.service.js";
import { hasAvailableLlmRequests, printLlmUsage } from "../../../cost/index.js";

/**
 * Ejecuta el caso de uso de evaluación automática.
 *
 * Mantiene una sesión interactiva donde cada respuesta
 * generada es evaluada antes de mostrarse al usuario.
 *
 * La sesión finaliza cuando el usuario utiliza /exit.
 *
 * @param rl Interfaz de consola compartida con el menú principal.
 * @param askClient Cliente responsable de generar respuestas.
 * @param evaluatorClient Cliente responsable de evaluarlas.
 * @return No retorna ningún valor.
 */
export async function evaluatorUseCase(
  rl: Interface,
  askClient: LlmClient,
  evaluatorClient: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(3)) {
    return;
  }
  console.log("");
  console.log("╔════════════════════════════════╗");
  console.log("║      LLM Evaluator Pattern     ║");
  console.log("╚════════════════════════════════╝");
  console.log("");

  // Crear el servicio utilizado durante toda la sesión.
  const evaluatorService = EvaluatorService.create(askClient, evaluatorClient);

  // Mostrar el saludo únicamente al iniciar este caso de uso.
  console.log(`🤖 ${GREETING_MESSAGE}`);
  console.log("");
  console.log("   Comandos: /usage, /exit");
  console.log("💡 Escribe /exit para volver al menú.");
  console.log("");

  while (true) {
    const message = (await rl.question("Tú: ")).trim();

    if (!message) {
      continue;
    }

    if (message === "/usage") {
      printLlmUsage();
      continue;
    }

    // Finalizar únicamente este caso de uso.
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
      console.log("🤖 Generando respuesta...");

      // Generar la primera respuesta candidata.
      const reply = await evaluatorService.ask(guardrailResult.sanitized);

      console.log("⚖️ Evaluando respuesta...");

      // Evaluar la respuesta antes de mostrarla.
      const evaluation = await evaluatorService.evaluateResponse(
        message,
        reply,
      );

      if (evaluation.is_acceptable) {
        console.log("✅ Evaluación aprobada.");
        console.log("");
        console.log(`Bilbo: ${reply}`);
        console.log("");

        continue;
      }

      console.log("❌ Evaluación rechazada.");
      console.log(`Feedback: ${evaluation.feedback}`);

      console.log("🔁 Generando respuesta corregida...");

      // Realizar un único reintento utilizando
      // el feedback generado por el evaluador.
      const correctedReply = await evaluatorService.rerun(
        message,
        reply,
        evaluation.feedback,
      );

      console.log("");
      console.log(`Bilbo: ${correctedReply}`);
      console.log("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      console.log(`\n❌ Error: ${errorMessage}\n`);
    }
  }
}
