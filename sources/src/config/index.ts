import { config as loadDotenv } from "dotenv";
import { AppConfig, MODEL_PROVIDERS, ModelProvider } from "../types/index.js";

// Carga las variables definidas en el archivo .env
loadDotenv();

/**
 * Obtiene una variable de entorno.
 * Si no existe, utiliza el valor por defecto.
 * Lanza un error si no hay valor disponible.
 */
function getRequiredEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;

  if (value === undefined) {
    throw new Error(`Variable de entorno requerida no encontrada: ${name}`);
  }

  return value;
}

/**
 * Valida que el proveedor configurado sea uno de los soportados.
 * Retorna el proveedor tipado correctamente.
 */
function validateProvider(value: string): ModelProvider {
  if (MODEL_PROVIDERS.includes(value as ModelProvider)) {
    return value as ModelProvider;
  }

  throw new Error(`Proveedor no válido: ${value}`);
}

// Obtiene el proveedor de modelos desde las variables de entorno.
// Si no está definido, utiliza "anthropic" por defecto.
const rawProvider = process.env["MODEL_PROVIDER"] ?? "anthropic";

/**
 * Configuración principal de la aplicación.
 * Centraliza todos los valores necesarios para los proveedores
 * de IA, embeddings, RAG y rutas locales.
 */
export const config: AppConfig = {
  // Proveedor de modelos (anthropic u openai)
  provider: validateProvider(rawProvider),

  // Clave API de Anthropic
  anthropicApiKey: getRequiredEnvVar("ANTHROPIC_API_KEY", ""),

  // Clave API de OpenAI
  openaiApiKey: getRequiredEnvVar("OPENAI_API_KEY", ""),

  // Modelo de lenguaje utilizado con Anthropic
  anthropicModel: getRequiredEnvVar("ANTHROPIC_MODEL", "claude-sonnet-4-6"),

  // Modelo de lenguaje utilizado con OpenAI
  openaiModel: getRequiredEnvVar("OPENAI_MODEL", "gpt-4o-mini"),

  // Modelo de embeddings usado para la indexación y búsqueda semántica
  openaiEmbeddingModel: getRequiredEnvVar(
    "OPENAI_EMBEDDING_MODEL",
    "text-embedding-3-small",
  ),

  // Ruta donde se encuentran los documentos a indexar
  docsPath: getRequiredEnvVar("DOCS_PATH", "./docs/sample_docs"),

  // Ruta de la base de datos vectorial local
  dbPath: getRequiredEnvVar("DB_PATH", "./data/vectors.db"),

  // Cantidad máxima de documentos recuperados en una consulta RAG
  ragTopK: parseInt(getRequiredEnvVar("RAG_TOP_K", "5"), 10),

  // Numero máximo de tokens
  max_tokens: parseInt(getRequiredEnvVar("MAX_TOKENS", "1024"), 10),

  // Otros clientes
  geminiApiKey: getRequiredEnvVar("GEMINI_API_KEY", ""),
  geminiModel: getRequiredEnvVar("GEMINI_MODEL", "gemini-2.5-flash-lite"),
  groqApiKey: getRequiredEnvVar("GROQ_API_KEY", ""),
  groqModel: getRequiredEnvVar("GROQ_MODEL", "llama-3.1-8b-instant"),
  ollamaHost: getRequiredEnvVar("OLLAMA_HOST", ""),
  ollamaModel: getRequiredEnvVar("OLLAMA_MODEL", "qwen2.5-coder:3b"),
};

/**
 * Valida que la configuración mínima requerida esté presente
 * según el proveedor de modelos seleccionado.
 *
 * Lanza una excepción si falta alguna credencial necesaria.
 */
export function validateConfig(): void {
  // Si se utiliza Anthropic, verificar que exista su API Key.
  if (config.provider === "anthropic" && !config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY está vacía. Agrégala en tu archivo .env",
    );
  }

  // Si se utiliza OpenAI, verificar que exista su API Key.
  if (config.provider === "openai" && !config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY está vacía. Agrégala en tu archivo .env");
  }

  // Si se utiliza Gemini, verificar que exista su API Key.
  if (config.provider === "gemini" && !config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY está vacía. Agrégala en tu archivo .env");
  }

  // Si se utiliza Groq, verificar que exista su API Key.
  if (config.provider === "groq" && !config.groqApiKey) {
    throw new Error("GROQ_API_KEY está vacía. Agrégala en tu archivo .env");
  }

  // Si se utiliza Groq, verificar que exista su API Key.
  if (config.provider === "ollama" && !config.ollamaHost) {
    throw new Error("OLLAMA_HOST está vacía. Agrégala en tu archivo .env");
  }
}

// Exporta la configuración como exportación por defecto
// para facilitar su importación en otros módulos.
export default config;
