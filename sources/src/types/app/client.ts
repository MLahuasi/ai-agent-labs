import { AgentRequest, AgentResponse } from "../agent/index.js";

/**
 * Contrato que debe implementar cualquier cliente LLM.
 *
 * Permite intercambiar proveedores sin modificar
 * el resto de la aplicacion.
 */
export interface LlmClient {
  /**
   * Genera una respuesta completa y la retorna una vez finalizada.
   */
  ask(params: AgentRequest): Promise<AgentResponse>;

  /**
   * Genera una respuesta en modo streaming.
   */
  stream(params: AgentRequest): Promise<AgentResponse>;
}

/**
 * Define el contrato para los clientes de embeddings.
 */
export interface EmbeddingClient {
  /**
   * Genera el embedding correspondiente a un único texto.
   *
   * @param text Texto que se convertirá en un vector de embedding.
   * @return Vector de embedding generado para el texto.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Genera los embeddings correspondientes a varios textos.
   *
   * @param texts Textos que se convertirán en vectores de embedding.
   * @return Vectores de embedding generados para los textos.
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
