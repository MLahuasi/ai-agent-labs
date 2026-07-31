import { ModelProvider } from "./index.js";

/**
 * Configuración principal de la aplicación.
 */
export interface AppConfig {
  /** Proveedor de IA seleccionado. */
  provider: ModelProvider;

  /** Clave de API para Anthropic. */
  anthropicApiKey: string;

  /** Clave de API para OpenAI. */
  openaiApiKey: string;

  /** Modelo de lenguaje utilizado con Anthropic. */
  anthropicModel: string;

  /** Modelo de lenguaje utilizado con OpenAI. */
  openaiModel: string;

  /** Modelo de embeddings utilizado para generar vectores en OpenAI. */
  openaiEmbeddingModel: string;

  /** Ruta donde se encuentran los documentos a indexar o consultar. */
  docsPath: string;

  /** Ruta donde se almacena la base de datos vectorial. */
  dbPath: string;

  /** Número máximo de chunks devueltos durante una búsqueda RAG. */
  ragTopK: number;

  /** Número máximo de tokens permitidos en una consulta al modelo. */
  max_tokens: number;

  // =========================
  // Otros proveedores LLM
  // =========================

  /** Clave de API para Google Gemini. */
  geminiApiKey: string;

  /** Modelo de lenguaje utilizado con Gemini. */
  geminiModel: string;

  /** Clave de API para Groq. */
  groqApiKey: string;

  /** Modelo de lenguaje utilizado con Groq. */
  groqModel: string;

  /** URL o dirección del servidor Ollama. */
  ollamaHost: string;

  /** Modelo local utilizado por Ollama. */
  ollamaModel: string;

  //========
  // Tools
  //=======
  max_iterations: number;
  max_tokens_tools: number;
}
