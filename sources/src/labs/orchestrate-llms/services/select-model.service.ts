import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";
import { MODEL_SELECTOR_SYSTEM_PROMPT } from "../prompts/select-model.prompt.js";
import {
  ModelSelectionResult,
  ModelTask,
  SelectableModel,
} from "../types/select-model.types.js";

/**
 * Servicio responsable de seleccionar dinámicamente
 * el modelo utilizado para resolver una solicitud.
 */
export class SelectModelService {
  /**
   * Inicializa el servicio con el modelo router
   * y los modelos disponibles.
   *
   * @param routerClient Cliente responsable de clasificar la solicitud.
   * @param models Modelos disponibles para cada categoría.
   */
  private constructor(
    private readonly routerClient: LlmClient,
    private readonly models: SelectableModel[],
  ) {}

  /**
   * Crea una instancia del servicio.
   *
   * @param routerClient Cliente responsable de clasificar la solicitud.
   * @param models Modelos disponibles para cada categoría.
   * @return Instancia configurada del servicio.
   */
  static create(
    routerClient: LlmClient,
    models: SelectableModel[],
  ): SelectModelService {
    return new SelectModelService(routerClient, models);
  }

  /**
   * Selecciona y ejecuta el modelo más apropiado
   * para la solicitud recibida.
   *
   * @param message Solicitud enviada por el usuario.
   * @return Respuesta y modelo seleccionado.
   */
  async ask(message: string): Promise<ModelSelectionResult> {
    // Determinar qué categoría debe resolver la solicitud.
    const task = await this.selectTask(message);

    // Obtener el modelo asociado a esa categoría.
    const selectedModel = this.getModel(task);

    // Ejecutar únicamente el modelo seleccionado.
    const result = await selectedModel.client.ask({
      prompt: message,
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
    });

    const answer = result.text.trim();

    if (!answer) {
      throw new Error("El modelo seleccionado no generó una respuesta.");
    }

    return {
      task,
      provider: selectedModel.provider,
      model: selectedModel.model,
      answer,
    };
  }

  /**
   * Clasifica una solicitud para determinar
   * qué tipo de modelo debe utilizarse.
   *
   * @param message Solicitud enviada por el usuario.
   * @return Categoría seleccionada.
   */
  private async selectTask(message: string): Promise<ModelTask> {
    const result = await this.routerClient.ask({
      prompt: message,
      systemPrompt: MODEL_SELECTOR_SYSTEM_PROMPT,
      maxTokens: config.max_tokens,
      maxTokensTools: 0,
      maxIterations: config.max_iterations,
    });

    return this.parseTask(result.text);
  }

  /**
   * Convierte la respuesta del router
   * en una categoría válida.
   *
   * @param rawResponse Respuesta JSON generada por el router.
   * @return Categoría seleccionada.
   */
  private parseTask(rawResponse: string): ModelTask {
    const selection = JSON.parse(rawResponse) as {
      task?: unknown;
    };

    if (
      selection.task !== "general" &&
      selection.task !== "code" &&
      selection.task !== "reasoning"
    ) {
      throw new Error("El router devolvió una categoría inválida.");
    }

    return selection.task;
  }

  /**
   * Obtiene el modelo configurado
   * para una categoría.
   *
   * @param task Categoría seleccionada.
   * @return Modelo asociado a la categoría.
   */
  private getModel(task: ModelTask): SelectableModel {
    const selectedModel = this.models.find((model) => model.task === task);

    if (!selectedModel) {
      throw new Error(`No existe un modelo configurado para: ${task}`);
    }

    return selectedModel;
  }
}
