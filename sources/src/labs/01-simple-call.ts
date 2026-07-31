import { LlmClient } from "../types/app/index.js";

export async function simpleCall(llm: LlmClient): Promise<void> {
  console.log("╔═════════════════════════════╗");
  console.log("║    Primera llamada a LLM    ║");
  console.log("╚═════════════════════════════╝");
  console.log("✅ Enviando pregunta ...");
  console.log("");
  const question =
    "Que es TypeScript y en que se diferencia con JavaScript. Responde máximo en 3 puntos concisos";
  console.log(` Pregunta: ${question}`);
  const answer = await llm.ask({
    prompt: question,
  });
  console.log("-".repeat(50));
  console.log(` Respuesta: ${answer.text}`);
  console.log(` Tokens Entrada: ${answer.totalInputTokens}`);
  console.log(` Tokens Salida: ${answer.totalOutputTokens}`);
  console.log("-".repeat(50));
}
