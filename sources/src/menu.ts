import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  codeReview,
  runGuardrail,
  simpleCall,
  starAgent,
  startAgenticLoop,
  startCLI,
  startOrchestrationMenu,
  startRagAgent,
  streamingResponse,
  systemPrompt,
} from "./labs/index.js";

import { LlmClient } from "./types/app/index.js";
import { GuardrailsService } from "./security/guardrails.service.js";
import { getLlmUsageLimiter } from "./llm/llm.instances.js";
import { formatDuration, printLlmUsage } from "./cost/utils/usage.utils.js";

/**
 * Muestra el menú principal de laboratorios.
 *
 * La interfaz readline se crea una única vez y se comparte
 * con todos los laboratorios que requieren interacción.
 *
 * Solo este método es responsable de cerrar readline.
 *
 * @param llm Cliente LLM configurado para los laboratorios.
 * @param guardrails Servicio de guardrails compartido durante la sesión.
 * @return No retorna ningún valor.
 */
export async function showMenu(
  llm: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      console.log("Seleccione un laboratorio:");
      console.log("1. Simple Call");
      console.log("2. System Prompt");
      console.log("3. Streaming Response");
      console.log("4. Chat");
      console.log("5. Read file and call LLM");
      console.log("6. Agentic Loop with tools");
      console.log("7. Agentic Loop with RAG");
      console.log("8. Agentic Loop");
      console.log("9. Orchestrate Llms");
      console.log("10. Security - Guardrails");
      console.log("0. Salir");

      const option = await rl.question("\nOpción: ");

      try {
        switch (option.trim()) {
          case "1":
            await simpleCall(llm, guardrails);
            break;

          case "2":
            await systemPrompt(llm, guardrails);
            break;

          case "3":
            await streamingResponse(llm, guardrails);
            break;

          case "4":
            /**
             * Se cierra el readline del menú antes de iniciar
             * el readline propio del chat.
             *
             * Esto evita tener dos interfaces leyendo
             * simultáneamente desde process.stdin.
             */
            await startCLI(rl, llm, guardrails);
            break;

          case "5":
            await codeReview(llm, guardrails);
            break;

          case "6":
            await startAgenticLoop(rl, llm, guardrails);
            break;

          case "7":
            await startRagAgent(rl, llm, guardrails);
            break;

          case "8":
            await starAgent(llm, guardrails);
            break;

          case "9":
            await startOrchestrationMenu(rl, guardrails);
            break;

          case "10":
            await runGuardrail();
            break;

          case "0":
            console.log("Hasta luego 👋");
            return;

          default:
            console.log("Opción inválida");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";

        const stats = getLlmUsageLimiter().getStats();

        // Si el límite fue alcanzado, mantener viva la aplicación
        // y mostrar cuándo podrá realizarse una nueva llamada.
        if (stats.remaining === 0) {
          console.log("");
          console.log("⚠️ Límite de llamadas LLM alcanzado.");
          console.log(`   • Usadas: ${stats.used} / ${stats.maxRequests}`);
          console.log("   • Disponibles: 0");
          console.log(
            `   • Próxima llamada disponible en: ` +
              `${formatDuration(stats.retryAfterMs)}`,
          );
          console.log("");
        }

        // Otros errores se muestran sin cerrar el menú.
        console.log(`\n❌ Error: ${message}\n`);
      }

      // Mostrar el estado actualizado al regresar de cualquier laboratorio.
      printLlmUsage();
    }
  } finally {
    rl.close();
  }
}
