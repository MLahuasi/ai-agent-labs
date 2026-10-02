import OpenAI from "openai";
import { config } from "../../../../config/index.js";
import { EmbeddingClient } from "../../../../types/app/index.js";
import {
  LlmUsageLimiterService,
  LlmUsageTrackerService,
} from "../../../../cost/index.js";

/**
 * Cliente encargado de gestionar la comunicación con OpenAI.
 */
export class OpenAiEmbeddingClient implements EmbeddingClient {
  // Cliente utilizado para realizar solicitudes a OpenAI.
  private readonly client: OpenAI;
  /** Controla la cantidad de llamadas realizadas al servicio de embeddings. */
  private readonly usageLimiter: LlmUsageLimiterService;

  /** Registra el consumo real generado por los embeddings. */
  private readonly usageTracker: LlmUsageTrackerService;

  constructor(
    usageLimiter: LlmUsageLimiterService,
    usageTracker: LlmUsageTrackerService,
  ) {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    this.usageLimiter = usageLimiter;
    this.usageTracker = usageTracker;
  }

  /**
   * Envía uno o varios textos al modelo de embeddings configurado.
   *
   * @param input Texto o lista de textos que se convertirán en embeddings.
   * @return Respuesta generada por el modelo de embeddings.
   */
  private async create(input: string | string[]) {
    // Valida y registra la llamada inmediatamente antes
    // de invocar al proveedor.
    this.usageLimiter.consume();

    const response = await this.client.embeddings.create({
      model: config.openaiEmbeddingModel,
      input,
    });

    // Registra el consumo real de la llamada de embeddings.
    this.usageTracker.record({
      provider: "openai",
      model: config.openaiEmbeddingModel,
      requests: 1,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: 0,
    });

    return response;
  }

  /**
   * Genera el embedding correspondiente a un único texto.
   *
   * @param text Texto que se convertirá en un vector de embedding.
   * @return Vector de embedding generado para el texto.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.create(text);

    // Obtiene el primer embedding generado.
    const embedding = response.data[0]?.embedding ?? [];

    return embedding;
  }

  /**
   * Genera los embeddings correspondientes a varios textos.
   *
   * @param texts Textos que se convertirán en vectores de embedding.
   * @return Vectores de embedding generados para los textos.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.create(texts);

    // Extrae los embeddings generados.
    const embeddings = response.data.map((item) => item.embedding);

    return embeddings;
  }
}
