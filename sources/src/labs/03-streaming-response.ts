import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/index.js";
import { LlmClient } from "../types/index.js";

const QUESTION = `Qué es async/await en javascript?, de manera resumida`;

export async function streamingResponse(llm: LlmClient): Promise<void> {
  console.log("╔══════════════════════════╗");
  console.log("║    Streaming Response    ║");
  console.log("╚══════════════════════════╝");
  console.log(` Pregunta: ${QUESTION}`);
  console.log("");
  console.log("✅ Demo 1: Enviando código SIN streaming");
  console.log("");
  const answer = await llm.ask(QUESTION);
  console.log("-".repeat(50));
  console.log(` Respuesta: ${answer.text}`);
  console.log(` Tokens Entrada: ${answer.totalInputTokens}`);
  console.log(` Tokens Salida: ${answer.totalOutputTokens}`);
  console.log("-".repeat(50));
  console.log("");

  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log("✅ Demo 2: Enviando código CON streaming");
  console.log("");
  console.log(` Respuesta:`);
  const answerStreaming = await llm.stream(
    QUESTION,
    DOCUMENTATION_ASSISTANT_PROMPT,
  );

  console.log(` Tokens Entrada: ${answerStreaming.totalInputTokens}`);
  console.log(` Tokens Salida: ${answerStreaming.totalOutputTokens}`);
  console.log("-".repeat(50));
  console.log("");
}
