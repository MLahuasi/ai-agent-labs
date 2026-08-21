import { config } from "../../../config/index.js";
import { hasAvailableLlmRequests } from "../../../cost/index.js";
import { LlmClient } from "../../../types/app/client.js";
import { QUESTION_GENERATOR_PROMPT } from "../prompts/compare.prompts.js";
import { CompareLlmService } from "../services/compare.service.js";
import { Competitor } from "../types/compare.types.js";

/**
 * Ejecuta el caso de uso de comparación de modelos LLM.
 *
 * Crea los modelos participantes, genera una pregunta común,
 * ejecuta los competidores en paralelo y utiliza un modelo juez
 * para clasificar las respuestas obtenidas.
 *
 * @return Promesa que finaliza cuando termina la comparación.
 */
export async function compareLlmsUseCase(
  competitors: Competitor[],
  questionGeneratorClient: LlmClient,
  judgeClient: LlmClient,
): Promise<void> {
  console.log("╔════════════════════════════════╗");
  console.log("║      Comparación de LLMs       ║");
  console.log("╚════════════════════════════════╝");
  console.log("");

  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(competitors.length + 2)) {
    return;
  }

  // 1. Generar una pregunta común para todos los competidores.
  const questionResult = await questionGeneratorClient.stream({
    prompt: QUESTION_GENERATOR_PROMPT,
    maxTokens: config.max_tokens,
    maxIterations: config.max_iterations,
    maxTokensTools: 0,
  });

  const question = questionResult.text.trim();

  if (!question) {
    throw new Error("No se pudo generar una pregunta para la comparación.");
  }

  console.log(question);
  console.log("");

  // Crear el servicio encargado de realizar la comparación.
  const service = CompareLlmService.create(question, competitors, judgeClient);

  // 2. Ejecutar todos los modelos con la misma pregunta.
  const answers = await service.executeCompetitors();

  // 3. Mostrar las respuestas obtenidas.
  service.printAnswers(answers);

  // 4. Evaluar y clasificar las respuestas.
  const ranking = await service.evaluateAnswers(answers);

  // 5. Mostrar el ranking final.
  service.printRanking(ranking, answers);
}
