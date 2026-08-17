import { config } from "../config/index.js";
import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/index.js";
import { LlmClient } from "../types/app/index.js";

const QUESTION = `Qué es async/await en javascript?, de manera resumida`;

/**
 * Compara una respuesta completa con una respuesta mediante streaming.
 *
 * @param llm Cliente LLM utilizado para generar las respuestas.
 * @return No retorna ningún valor.
 */
export async function streamingResponse(llm: LlmClient): Promise<void> {
  console.log("╔══════════════════════════╗");
  console.log("║    Streaming Response    ║");
  console.log("╚══════════════════════════╝");
  console.log(` Pregunta: ${QUESTION}`);
  console.log("");

  console.log("✅ Demo 1: Enviando solicitud SIN streaming");
  console.log("");

  const answer = await llm.ask({
    prompt: QUESTION,
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
    prompt: QUESTION,
    systemPrompt: DOCUMENTATION_ASSISTANT_PROMPT,
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
  });

  console.log(` Tokens Entrada: ${answerStreaming.totalInputTokens}`);
  console.log(` Tokens Salida: ${answerStreaming.totalOutputTokens}`);
  console.log("-".repeat(50));
  console.log("");
}
