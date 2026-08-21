import { config } from "../../config/index.js";
import { hasAvailableLlmRequests } from "../../cost/index.js";
import { GuardrailsService } from "../../security/guardrails.service.js";
import { LlmClient } from "../../types/app/index.js";
import { FileReviewerService } from "../services/file-reviewer.service.js";
import { CodeReviewUseCaseResult } from "../types/file-reviewer.types.js";

/**
 * Ejecuta una revisión de código sobre un archivo.
 *
 * Valida previamente la disponibilidad de requests y el prompt antes
 * de delegar la revisión al FileReviewerService.
 *
 * @param llm Cliente LLM utilizado para realizar la revisión.
 * @param systemPrompt Instrucciones de sistema utilizadas por el modelo.
 * @param question Pregunta utilizada para realizar la revisión.
 * @param filePath Ruta del archivo que será revisado.
 * @param guardrails Servicio utilizado para validar el prompt.
 * @return Resultado de la ejecución del caso de uso.
 */
export async function codeReviewUseCase(
  llm: LlmClient,
  systemPrompt: string,
  question: string,
  filePath: string,
  guardrails: GuardrailsService,
): Promise<CodeReviewUseCaseResult> {
  if (!hasAvailableLlmRequests(1)) {
    return {
      success: false,
      message:
        "insufficient_requests: No existen requests suficientes para realizar la revisión.",
    };
  }

  const guardrailResult = guardrails.checkInput(question);

  if (!guardrailResult.safe) {
    return {
      success: false,
      message:
        "guardrail_rejected" +
        (guardrailResult.reason ?? "El prompt fue rechazado por guardrails."),
    };
  }

  const reviewer = FileReviewerService.create(
    llm,
    {
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    },
    {
      maxChars: 50_000,
      rejectUnsupportedExtensions: true,
    },
  );

  const result = await reviewer.review({
    filePath,
    prompt: guardrailResult.sanitized,
    systemPrompt,
    mode: "stream",
    onChunk: (chunk) => {
      process.stdout.write(chunk);
    },
  });

  return {
    success: true,
    data: result,
  };
}
