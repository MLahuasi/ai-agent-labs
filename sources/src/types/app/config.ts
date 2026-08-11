import { ModelProvider } from "./index.js";

/**
 * Configuración principal de la aplicación.
 */
export interface AppConfig {
  // LLMS SETTINGS
  /** Clave de API para Anthropic. */
  anthropicApiKey: string;
  /** Modelo de lenguaje utilizado con Anthropic. */
  anthropicModel: string;
  /** Clave de API para OpenAI. */
  openaiApiKey: string;
  /** Modelo de lenguaje utilizado con OpenAI. */
  openaiModel: string;
  // Otros clientes
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

  // === CONFIGURACIÓN DEL MODELO ===
  /** Proveedor de IA seleccionado. */
  provider: ModelProvider;
  /** Número máximo de tokens permitidos en una consulta al modelo. */
  max_tokens: number;
  /** Imprimir logs respuestas llms */
  print_logs: boolean;

  // === RAG ===
  /** Modelo de embeddings utilizado para generar vectores en OpenAI. */
  openaiEmbeddingModel: string;
  /** Ruta donde se encuentran los documentos a indexar o consultar. */
  docsPath: string;
  /** Ruta donde se almacena la base de datos vectorial. */
  dbPath: string;
  /** Número máximo de chunks devueltos durante una búsqueda RAG. */
  ragTopK: number;
  // Separador de secciones del archivo
  separator: string;
  // Extension de archivo que se usará en RAG
  extention: string;
  // Tamaño del Chunk
  targetChunkSize: number;
  // Se usa para definir un porcentaje +- de extensión de un RAG
  chunkSizeTolerance: number;

  //========
  // Tools
  //=======
  max_iterations: number;
  max_tokens_tools: number;
}
