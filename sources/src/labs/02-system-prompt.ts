import { config } from "../config/index.js";
import { hasAvailableLlmRequests } from "../cost/index.js";
import { CODE_REVIEWER_PROMPT } from "../llm/prompts/index.js";
import { GuardrailsService } from "../security/guardrails.service.js";
import { LlmClient } from "../types/app/index.js";

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

/**
 * Compara una consulta realizada sin system prompt y con system prompt.
 *
 * @param llm Cliente LLM utilizado para generar las respuestas.
 * @return No retorna ningún valor.
 */
export async function systemPrompt(
  llm: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
  console.log("╔═══════════════════════╗");
  console.log("║    System Prompts     ║");
  console.log("╚═══════════════════════╝");

  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(2)) {
    return;
  }

  const question =
    `Revisa este código:\n` + `\`\`\`javascript\n${CODIGO_CON_PROBLEMAS}\`\`\``;

  // Validar el prompt antes de enviarlo al LLM.
  const guardrailResult = guardrails.checkInput(question);

  if (!guardrailResult.safe) {
    guardrails.printResult("", question, guardrailResult);
  } else {
    console.log(` Pregunta: ${guardrailResult.sanitized}`);
    console.log("");

    console.log("✅ Demo 1: Enviando código SIN system prompt");
    console.log("");

    const answer = await llm.ask({
      prompt: question,
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

    console.log("✅ Demo 2: Enviando código CON system prompt");
    console.log("");

    const reviewerPromptAnswer = await llm.ask({
      prompt: guardrailResult.sanitized,
      systemPrompt: CODE_REVIEWER_PROMPT,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    });

    console.log("-".repeat(50));
    console.log(` Respuesta: ${reviewerPromptAnswer.text}`);
    console.log(` Tokens Entrada: ${reviewerPromptAnswer.totalInputTokens}`);
    console.log(` Tokens Salida: ${reviewerPromptAnswer.totalOutputTokens}`);
    console.log("-".repeat(50));
    console.log("");
  }
}
