import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";
import { ANSWER_LIMIT } from "../prompts/compare.prompts.js";
import {
  Competitor,
  JudgeResponse,
  ModelAnswer,
} from "../types/compare.types.js";

/**
 * Servicio responsable de ejecutar y comparar
 * respuestas generadas por múltiples LLMs.
 */
export class CompareLlmService {
  /**
   * Inicializa el servicio con los modelos participantes,
   * la pregunta común y el modelo utilizado como juez.
   *
   * @param question Pregunta enviada a todos los modelos.
   * @param competitors Modelos participantes en la comparación.
   * @param judgeClient Cliente utilizado para evaluar las respuestas.
   */
  private constructor(
    private readonly question: string,
    private readonly competitors: Competitor[],
    private readonly judgeClient: LlmClient,
  ) {}

  /**
   * Crea una instancia configurada del servicio.
   *
   * @param question Pregunta enviada a todos los modelos.
   * @param competitors Modelos participantes en la comparación.
   * @param judgeClient Cliente utilizado para evaluar las respuestas.
   * @return Instancia configurada de CompareLlmService.
   */
  static create(
    question: string,
    competitors: Competitor[],
    judgeClient: LlmClient,
  ): CompareLlmService {
    return new CompareLlmService(question, competitors, judgeClient);
  }

  /**
   * Ejecuta la misma pregunta contra todos
   * los modelos participantes.
   *
   * Los modelos se ejecutan en paralelo porque
   * cada respuesta es independiente.
   *
   * @return Respuestas generadas por todos los competidores.
   */
  async executeCompetitors(): Promise<ModelAnswer[]> {
    // Ejecutar todos los modelos de forma concurrente.
    const answers = await Promise.all(
      this.competitors.map((competitor) => this.askCompetitor(competitor)),
    );

    return answers;
  }

  /**
   * Evalúa y clasifica las respuestas utilizando
   * el cliente configurado como modelo juez.
   *
   * @param answers Respuestas generadas por los competidores.
   * @return Ranking con los índices ordenados de mejor a peor.
   */
  async evaluateAnswers(answers: ModelAnswer[]): Promise<number[]> {
    // Construir el prompt con todas las respuestas.
    const prompt = this.buildJudgePrompt(answers);

    // Solicitar al juez que genere el ranking.
    const result = await this.judgeClient.stream({
      prompt,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    });

    const rawRanking = result.text.trim();

    console.log("");
    console.log("**** RESULTADO DEL JUEZ *****");
    console.log(rawRanking);
    console.log("");

    // Validar el ranking antes de utilizarlo.
    return this.parseRanking(rawRanking, answers.length);
  }

  /**
   * Muestra las respuestas generadas
   * por todos los modelos participantes.
   *
   * @param answers Respuestas generadas por los competidores.
   * @return No retorna ningún valor.
   */
  printAnswers(answers: ModelAnswer[]): void {
    console.log("");
    console.log("**** RESPUESTAS MODELOS *****");
    console.log("");

    for (const answer of answers) {
      console.log("-".repeat(60));

      console.log(`${answer.provider} / ${answer.model}`);

      console.log("");
      console.log(answer.answer);
      console.log("");

      console.log(`Tokens Entrada: ${answer.totalInputTokens}`);

      console.log(`Tokens Salida: ${answer.totalOutputTokens}`);
    }

    console.log("-".repeat(60));
  }

  /**
   * Muestra el ranking final generado
   * por el modelo juez.
   *
   * @param ranking Índices ordenados de mejor a peor.
   * @param answers Respuestas asociadas a los competidores.
   * @return No retorna ningún valor.
   */
  printRanking(ranking: number[], answers: ModelAnswer[]): void {
    console.log("");
    console.log("**** RANKING *****");
    console.log("");

    // Relacionar cada índice con el modelo correspondiente.
    ranking.forEach((competitorIndex, position) => {
      const answer = answers[competitorIndex - 1];

      if (!answer) {
        throw new Error(`Competidor no encontrado: ${competitorIndex}`);
      }

      console.log(
        `Rank ${position + 1}: ` + `${answer.provider} / ${answer.model}`,
      );
    });
  }

  /**
   * Envía la pregunta común a un modelo participante.
   *
   * @param competitor Modelo que debe responder la pregunta.
   * @return Respuesta normalizada junto con sus métricas.
   */
  private async askCompetitor(competitor: Competitor): Promise<ModelAnswer> {
    console.log(
      `---- LLAMAR A ${competitor.provider.toUpperCase()} / ${competitor.model} ----`,
    );

    // Todos los modelos reciben exactamente
    // la misma pregunta y restricciones.
    const result = await competitor.client.stream({
      prompt: `${this.question}\n\n${ANSWER_LIMIT}`,
      maxTokens: config.max_tokens,
      maxTokensTools: 0,
      maxIterations: config.max_iterations,
    });

    return {
      provider: competitor.provider,
      model: competitor.model,
      answer: result.text.trim(),
      totalInputTokens: result.totalInputTokens,
      totalOutputTokens: result.totalOutputTokens,
    };
  }

  /**
   * Construye el prompt enviado al modelo juez.
   *
   * @param answers Respuestas que deben ser comparadas.
   * @return Prompt utilizado para generar el ranking.
   */
  private buildJudgePrompt(answers: ModelAnswer[]): string {
    // Numerar las respuestas para permitir
    // que el juez genere un ranking por índices.
    const competitors = answers
      .map(({ provider, model, answer }, index) =>
        `
Competidor ${index + 1}

Proveedor: ${provider}
Modelo: ${model}
Respuesta: ${answer}
`.trim(),
      )
      .join("\n\n");

    const expectedResult = answers.map((_, index) => index + 1);

    return `
Estás evaluando respuestas de varios modelos
a exactamente la misma pregunta.

Pregunta:

${this.question}

Evalúa cada respuesta considerando:

- calidad del razonamiento;
- manejo de restricciones;
- claridad;
- utilidad de la respuesta.

Reglas de respuesta:

- Devuelve únicamente un objeto JSON válido.
- No uses Markdown.
- No uses bloques de código.
- No uses \`\`\`json ni \`\`\`.
- No agregues explicaciones antes o después del JSON.
- Cada competidor debe aparecer exactamente una vez.
- El primer número representa al mejor competidor.

Formato esperado:

{"resultados":[${expectedResult.join(",")}]}

Respuestas:

${competitors}
`.trim();
  }

  /**
   * Convierte y valida el ranking generado
   * por el modelo juez.
   *
   * @param rawResponse Respuesta JSON generada por el juez.
   * @param expectedCompetitors Número de competidores esperados.
   * @return Ranking validado.
   */
  private parseRanking(
    rawResponse: string,
    expectedCompetitors: number,
  ): number[] {
    // Convertir la respuesta textual a JSON.
    const parsed = JSON.parse(rawResponse) as JudgeResponse;

    const resultados = parsed.resultados;

    // Validar la estructura mínima esperada.
    if (
      !Array.isArray(resultados) ||
      resultados.length !== expectedCompetitors
    ) {
      throw new Error("El juez devolvió un ranking inválido.");
    }

    // Comprobar que no existan competidores repetidos.
    if (new Set(resultados).size !== expectedCompetitors) {
      throw new Error("El ranking contiene competidores repetidos.");
    }

    // Comprobar que todos los índices sean válidos.
    const hasInvalidIndex = resultados.some(
      (competitorIndex) =>
        !Number.isInteger(competitorIndex) ||
        competitorIndex < 1 ||
        competitorIndex > expectedCompetitors,
    );

    if (hasInvalidIndex) {
      throw new Error("El ranking contiene índices inválidos.");
    }

    return resultados;
  }
}
