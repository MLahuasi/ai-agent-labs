import { config } from "../config/index.js";
import {
  createAnthropicClient,
  createGeminiClient,
  createGroqClient,
  createOllamaClient,
  createOpenAiClient,
} from "./llm.instances.js";
import { LlmClient } from "../types/app/index.js";

/**
 * Crea el cliente LLM configurado para el proveedor seleccionado.
 *
 * Utiliza la configuración de la aplicación para inicializar
 * el cliente correspondiente y sus opciones específicas.
 *
 * @return Cliente LLM configurado y modelo seleccionado.
 * @throws Error cuando el proveedor configurado no está soportado.
 */
export function createLlmProvider(): {
  client: LlmClient;
  model: string;
} {
  switch (config.provider) {
    case "anthropic":
      return {
        client: createAnthropicClient(),
        model: config.anthropicModel,
      };

    case "openai":
      return {
        client: createOpenAiClient(),
        model: config.openaiModel,
      };

    case "gemini":
      return {
        client: createGeminiClient(),
        model: config.geminiModel,
      };

    case "groq":
      return {
        client: createGroqClient(),
        model: config.groqModel,
      };

    case "ollama":
      return {
        client: createOllamaClient(),
        model: config.ollamaModel,
      };
  }
}
