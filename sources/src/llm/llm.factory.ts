import { config } from "../config/index.js";
import { LlmClient } from "../types/app/index.js";

import {
  AnthropicClient,
  OpenAiClient,
  GeminiClient,
  GroqClient,
  OllamaClient,
} from "./clients/index.js";

export function createLlmProvider():
  | {
      client: LlmClient;
      model: string;
    }
  | undefined {
  switch (config.provider) {
    case "anthropic":
      return {
        client: new AnthropicClient(),
        model: config.anthropicModel,
      };

    case "openai":
      return {
        client: new OpenAiClient(),
        model: config.openaiModel,
      };

    case "gemini":
      return {
        client: new GeminiClient(),
        model: config.geminiModel,
      };

    case "groq":
      return {
        client: new GroqClient(),
        model: config.groqModel,
      };

    case "ollama":
      return {
        client: new OllamaClient(),
        model: config.ollamaModel,
      };
  }
}
