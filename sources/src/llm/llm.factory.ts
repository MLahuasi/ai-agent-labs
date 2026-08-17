import { config } from "../config/index.js";
import { LlmClient } from "../types/app/index.js";

import {
  AnthropicClient,
  OpenAiClient,
  GeminiClient,
  GroqClient,
  OllamaClient,
} from "./clients/chat/index.js";
import { ollamaSystemPrompt } from "./prompts/index.js";

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
        client: new AnthropicClient({
          apiKey: config.anthropicApiKey,
          model: config.anthropicModel,
        }),
        model: config.anthropicModel,
      };

    case "openai":
      return {
        client: new OpenAiClient({
          apiKey: config.openaiApiKey,
          model: config.openaiModel,
        }),
        model: config.openaiModel,
      };

    case "gemini":
      return {
        client: new GeminiClient({
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
        }),
        model: config.geminiModel,
      };

    case "groq":
      return {
        client: new GroqClient({
          apiKey: config.groqApiKey,
          model: config.groqModel,
        }),
        model: config.groqModel,
      };

    case "ollama":
      return {
        client: new OllamaClient({
          host: config.ollamaHost,
          model: config.ollamaModel,
          systemPrompt: ollamaSystemPrompt,
          think: false,
          keepAlive: "10m",
          temperature: 0,
          numCtx: 4096,
        }),
        model: config.ollamaModel,
      };
  }
}
