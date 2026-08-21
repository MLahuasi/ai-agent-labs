import { config } from "../config/index.js";
import { hasAvailableLlmRequests } from "../cost/index.js";
import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/index.js";
import { GuardrailsService } from "../security/guardrails.service.js";
import { LlmClient } from "../types/app/index.js";

/**
 * Compara una respuesta completa con una respuesta mediante streaming.
 *
 * @param llm Cliente LLM utilizado para generar las respuestas.
 * @return No retorna ningún valor.
 */
export async function streamingResponse(
  llm: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
  const question = `Qué es async/await en javascript?, de manera resumida`;
  console.log("╔══════════════════════════╗");
  console.log("║    Streaming Response    ║");
  console.log("╚══════════════════════════╝");
  console.log(` Pregunta: ${question}`);
  console.log("");

  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(2)) {
    return;
  }

  // Validar el prompt antes de enviarlo al LLM.
  const guardrailResult = guardrails.checkInput(question);

  if (!guardrailResult.safe) {
    guardrails.printResult("", question, guardrailResult);
  } else {
    console.log("✅ Demo 1: Enviando solicitud SIN streaming");
    console.log("");

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
    console.log("");

    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("✅ Demo 2: Enviando solicitud CON streaming");
    console.log("");
    console.log(" Respuesta:");

    const answerStreaming = await llm.stream({
      prompt: guardrailResult.sanitized,
      systemPrompt: DOCUMENTATION_ASSISTANT_PROMPT,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
      onChunk: (chunk) => {
        process.stdout.write(chunk);
      },
    });

    process.stdout.write(answerStreaming.text);
    console.log(` Tokens Entrada: ${answerStreaming.totalInputTokens}`);
    console.log(` Tokens Salida: ${answerStreaming.totalOutputTokens}`);
    console.log("-".repeat(50));
    console.log("");
  }
}
