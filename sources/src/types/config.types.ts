/**
 * Proveedores de modelos de IA soportados por la aplicación.
 */
export const MODEL_PROVIDERS = [
  "anthropic",
  "openai",
  "gemini",
  "groq",
  "ollama",
] as const;
2;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

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

  /** Número máximo de tokens que puede usar una consulta */
  max_tokens: number;

  // OTROS LLMS
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  ollamaHost: string;
  ollamaModel: string;
}
