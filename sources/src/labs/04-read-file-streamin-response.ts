import { FileReviewer } from "../files/index.js";
import { CODE_REVIEWER_PROMPT } from "../llm/prompts/index.js";
import { LlmClient } from "../types/app/index.js";

const FILE_PATH = "./src/labs/assets/rest-api.service.cs";

/**
 * Ejecuta una revisión de código utilizando streaming.
 */
export async function codeReview(llm: LlmClient): Promise<void> {
  const question = "Analiza este codigo fuente";
  const reviewer = new FileReviewer(llm, question, CODE_REVIEWER_PROMPT, {
    maxChars: 50_000,
    rejectUnsupportedExtensions: true,
  });

  console.log("╔══════════════════════════╗");
  console.log("║      Code Reviewer       ║");
  console.log("╚══════════════════════════╝");
  console.log(` Archivo: ${FILE_PATH}`);
  console.log("");

  console.log("✅ Demo 1: Revisando código CON streaming");
  console.log("");
  console.log(` Pregunta: ${question}`);
  console.log(" Respuesta:");

  const result = await reviewer.reviewFile(FILE_PATH, "stream");

  console.log("");
  console.log("-".repeat(50));
  console.log(` Archivo revisado: ${result.fileName}`);
  console.log(` Ruta: ${result.filePath}`);
  console.log(` Líneas: ${result.totalLines}`);
  console.log(` Caracteres: ${result.totalCharacters}`);
  console.log(` Caracteres revisados: ${result.reviewedCharacters}`);
  console.log(` Contenido truncado: ${result.truncated ? "Sí" : "No"}`);

  if (result.warnings.length > 0) {
    console.log("");
    console.log(" Advertencias:");

    for (const warning of result.warnings) {
      console.log(` ⚠️ ${warning}`);
    }
  }

  console.log("");
  console.log(` Tokens Entrada: ${result.totalInputTokens}`);
  console.log(` Tokens Salida: ${result.totalOutputTokens}`);
  console.log("-".repeat(50));
  console.log("");
}
