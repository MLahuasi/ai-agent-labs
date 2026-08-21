import { codeReviewUseCase } from "../code-review/index.js";
import { CODE_REVIEWER_PROMPT } from "../llm/prompts/index.js";
import { GuardrailsService } from "../security/guardrails.service.js";
import { LlmClient } from "../types/app/index.js";

const FILE_PATH = "./src/labs/assets/rest-api.service.cs";

/**
 * Ejecuta una revisión de código utilizando streaming.
 *
 * @param llm Cliente LLM utilizado para realizar la revisión.
 * @return No retorna ningún valor.
 */
export async function codeReview(
  llm: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
  const question = "Analiza este código fuente";

  const result = await codeReviewUseCase(
    llm,
    CODE_REVIEWER_PROMPT,
    question,
    FILE_PATH,
    guardrails,
  );

  if (!result.data) {
    console.log(result.message);
    return;
  }

  console.log("╔══════════════════════════╗");
  console.log("║       Code Review        ║");
  console.log("╚══════════════════════════╝");
  console.log(` Archivo: ${FILE_PATH}`);
  console.log("");

  console.log("✅ Demo 1: Revisando código CON streaming");
  console.log("");
  console.log(` Pregunta: ${result.data.question}`);
  console.log(" Respuesta:");

  process.stdout.write(result.data.review);

  console.log("");
  console.log("-".repeat(50));
  console.log(` Archivo revisado: ${result.data.fileName}`);
  console.log(` Ruta: ${result.data.filePath}`);
  console.log(` Líneas: ${result.data.totalLines}`);
  console.log(` Caracteres: ${result.data.totalCharacters}`);
  console.log(` Caracteres revisados: ${result.data.reviewedCharacters}`);
  console.log(` Contenido truncado: ${result.data.truncated ? "Sí" : "No"}`);

  if (result.data.warnings.length > 0) {
    console.log("");
    console.log(" Advertencias:");

    for (const warning of result.data.warnings) {
      console.log(` ⚠️ ${warning}`);
    }
  }

  console.log("");
  console.log(` Tokens Entrada: ${result.data.totalInputTokens}`);
  console.log(` Tokens Salida: ${result.data.totalOutputTokens}`);
  console.log("-".repeat(50));
  console.log("");
}
