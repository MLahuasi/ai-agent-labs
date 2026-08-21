import { config } from "../config/index.js";
import { hasAvailableLlmRequests } from "../cost/index.js";
import { GuardrailsService } from "../security/guardrails.service.js";
import { LlmClient } from "../types/app/index.js";

/**
 * Realiza una consulta básica al LLM sin historial ni herramientas.
 *
 * @param llm Cliente LLM utilizado para generar la respuesta.
 * @return No retorna ningún valor.
 */
export async function simpleCall(
  llm: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
  console.log("╔═══════════════════════╗");
  console.log("║    Simple Call LLM    ║");
  console.log("╚═══════════════════════╝");
  console.log("✅ Enviando pregunta ...");
  console.log("");

  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(1)) {
    return;
  }

  const question =
    "Que es TypeScript y en que se diferencia con JavaScript. " +
    "Responde máximo en 3 puntos concisos";

  // Validar el prompt antes de enviarlo al LLM.
  const guardrailResult = guardrails.checkInput(question);

  if (!guardrailResult.safe) {
    guardrails.printResult("", question, guardrailResult);
  } else {
    console.log(` Pregunta: ${guardrailResult.sanitized}`);

    const answer = await llm.ask({
      prompt: guardrailResult.sanitized,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    });

    console.log("-".repeat(50));
    console.log(` Respuesta: ${answer.text}`);
    console.log(` Tokens Entrada: ${answer.totalInputTokens}`);
    console.log(` Tokens Salida: ${answer.totalOutputTokens}`);
    console.log("-".repeat(50));
  }
}
