import OpenAI from "openai";
import { config } from "../../../../config/index.js";

export class OpenAiEmbeddingClient {
  /** Cliente oficial de OpenAI utilizado para generar embeddings. */
  private readonly client: OpenAI;

  /** Inicializa el cliente de OpenAI con la API key configurada. */
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /** Envía uno o varios textos al modelo de embeddings configurado. */
  private async create(input: string | string[]) {
    return await this.client.embeddings.create({
      model: config.openaiEmbeddingModel,
      input,
    });
  }

  /** Genera el vector de embedding correspondiente a un único texto. */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.create(text);

    /** Obtiene el primer embedding o devuelve un arreglo vacío. */
    const embedding = response.data[0]?.embedding ?? [];

    return embedding;
  }

  /** Genera un vector de embedding por cada texto recibido. */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.create(texts);

    /** Extrae únicamente los vectores de la respuesta del modelo. */
    const embeddings = response.data.map((item) => item.embedding);

    return embeddings;
  }
}
