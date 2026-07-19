import { CODE_REVIEWER_PROMPT } from "../llm/prompts/index.js";
import { LlmClient } from "../types/index.js";

const CODIGO_CON_PROBLEMAS = `
async function getUser(id) {
  const query = "SELECT * FROM users WHERE id = " + id;
  const result = await db.query(query);
  return result[0];
}

function calcularDescuento(precio, tipo) {
  if (tipo == "vip") {
    return precio * 0.8;
  } else if (tipo == "regular") {
    return precio * 0.9;
  } else {
    return precio;
  }
}
`;

export async function systemPrompt(llm: LlmClient): Promise<void> {
  console.log("╔═══════════════════════╗");
  console.log("║    System Prompts     ║");
  console.log("╚═══════════════════════╝");
  const question = `Revisa este código:\n\`\`\`javascript\n ${CODIGO_CON_PROBLEMAS}\`\`\``;
  console.log(` Pregunta: ${question}`);
  console.log("");
  console.log("✅ Demo 1: Enviando código SIN system prompt");
  console.log("");
  const answer = await llm.ask(question);
  console.log("-".repeat(50));
  console.log(` Respuesta: ${answer.text}`);
  console.log(` Tokens Entrada: ${answer.totalInputTokens}`);
  console.log(` Tokens Salida: ${answer.totalOutputTokens}`);
  console.log("-".repeat(50));
  console.log("");
  console.log("✅ Demo 2: Enviando código CON system prompt");
  console.log("");
  const reviewerPromptAnswer = await llm.ask(question, CODE_REVIEWER_PROMPT);
  console.log("-".repeat(50));
  console.log(` Respuesta: ${reviewerPromptAnswer.text}`);
  console.log(` Tokens Entrada: ${reviewerPromptAnswer.totalInputTokens}`);
  console.log(` Tokens Salida: ${reviewerPromptAnswer.totalOutputTokens}`);
  console.log("-".repeat(50));
  console.log("");
}
