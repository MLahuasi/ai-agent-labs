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
