import OpenAI from "openai";
import { config } from "../../../../config/index.js";
import { EmbeddingClient } from "../../../../types/app/index.js";

/**
 * Cliente encargado de gestionar la comunicación con OpenAI.
 */
export class OpenAiEmbeddingClient implements EmbeddingClient {
  // Cliente utilizado para realizar solicitudes a OpenAI.
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /**
   * Envía uno o varios textos al modelo de embeddings configurado.
   *
   * @param input Texto o lista de textos que se convertirán en embeddings.
   * @return Respuesta generada por el modelo de embeddings.
   */
  private async create(input: string | string[]) {
    return await this.client.embeddings.create({
      model: config.openaiEmbeddingModel,
      input,
    });
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
