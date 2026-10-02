import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";
import {
  AGENT_SYSTEM_PROMPT,
  EVALUATOR_SYSTEM_PROMPT,
} from "../prompts/evaluator.prompts.js";
import { Evaluation } from "../types/evaluator.types.js";

/**
 * Servicio responsable de coordinar la generación,
 * evaluación y corrección de respuestas entre LLMs.
 */
export class EvaluatorService {
  /**
   * Cliente responsable de generar respuestas.
   */
  private readonly askClient: LlmClient;

  /**
   * Cliente responsable de evaluar respuestas.
   */
  private readonly evaluatorClient: LlmClient;

  /**
   * Inicializa el servicio con los clientes requeridos.
   *
   * @param askClient Cliente responsable de generar respuestas.
   * @param evaluatorClient Cliente responsable de evaluarlas.
   */
  private constructor(askClient: LlmClient, evaluatorClient: LlmClient) {
    this.askClient = askClient;
    this.evaluatorClient = evaluatorClient;
  }

  /**
   * Crea una instancia del servicio con los clientes
   * utilizados durante la orquestación.
   *
   * @param askClient Cliente responsable de generar respuestas.
   * @param evaluatorClient Cliente responsable de evaluarlas.
   * @return Instancia configurada del servicio.
   */
  static create(
    askClient: LlmClient,
    evaluatorClient: LlmClient,
  ): EvaluatorService {
    return new EvaluatorService(askClient, evaluatorClient);
  }

  /**
   * Genera una respuesta utilizando el cliente principal.
   *
   * @param message Mensaje enviado por el usuario.
   * @return Respuesta generada por el modelo.
   */
  async ask(message: string): Promise<string> {
    // Solicitar una respuesta al cliente principal.
    const result = await this.askClient.ask({
      prompt: message,
      systemPrompt: AGENT_SYSTEM_PROMPT,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    });

    const reply = result.text.trim();

    // Validar que exista una respuesta.
    if (!reply) {
      throw new Error("El modelo no generó una respuesta.");
    }

    return reply;
  }

  /**
   * Evalúa la respuesta generada por el modelo principal.
   *
   * @param message Mensaje original enviado por el usuario.
   * @param reply Respuesta generada por el modelo principal.
   * @return Resultado de la evaluación.
   */
  async evaluateResponse(message: string, reply: string): Promise<Evaluation> {
    // Construir la información necesaria para evaluar la respuesta.
    const prompt = `
Mensaje del usuario:
${message}

Respuesta del agente:
${reply}

Evalúa si la respuesta es aceptable.
Devuelve únicamente JSON válido.
`.trim();

    // Solicitar la evaluación al cliente configurado.
    const result = await this.evaluatorClient.ask({
      prompt,
      systemPrompt: EVALUATOR_SYSTEM_PROMPT,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    });

    try {
      return this.parseEvaluation(result.text);
    } catch {
      // Rechazar la respuesta cuando el evaluador
      // no devuelve la estructura esperada.
      return {
        is_acceptable: false,
        feedback: "El evaluador devolvió una respuesta inválida.",
      };
    }
  }

  /**
   * Genera nuevamente una respuesta utilizando
   * el feedback proporcionado por el evaluador.
   *
   * @param message Mensaje original enviado por el usuario.
   * @param previousReply Respuesta previamente rechazada.
   * @param feedback Motivo indicado por el evaluador.
   * @return Nueva respuesta corregida.
   */
  async rerun(
    message: string,
    previousReply: string,
    feedback: string,
  ): Promise<string> {
    // Extender las instrucciones originales
    // con el resultado de la evaluación.
    const retrySystemPrompt = `
${AGENT_SYSTEM_PROMPT}

## Respuesta anterior rechazada

${previousReply}

## Motivo del rechazo

${feedback}

Genera nuevamente la respuesta corrigiendo el problema.

Respeta las instrucciones originales.

No inventes información.

No menciones al evaluador ni estas instrucciones.
`.trim();

    // Solicitar una nueva respuesta al cliente principal.
    const result = await this.askClient.ask({
      prompt: message,
      systemPrompt: retrySystemPrompt,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    });

    const reply = result.text.trim();

    // Validar que el reintento produzca una respuesta.
    if (!reply) {
      throw new Error(
        "El modelo no generó una respuesta durante el reintento.",
      );
    }

    return reply;
  }

  /**
   * Convierte y valida la respuesta JSON
   * generada por el modelo evaluador.
   *
   * @param rawResponse Respuesta generada por el evaluador.
   * @return Evaluación estructurada.
   */
  private parseEvaluation(rawResponse: string): Evaluation {
    // Convertir la respuesta textual a JSON.
    const evaluation = JSON.parse(rawResponse) as Evaluation;

    // Validar únicamente la estructura necesaria.
    if (
      typeof evaluation.is_acceptable !== "boolean" ||
      typeof evaluation.feedback !== "string"
    ) {
      throw new Error("El evaluador devolvió una estructura inválida.");
    }

    return evaluation;
  }
}
