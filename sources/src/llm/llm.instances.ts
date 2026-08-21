import { config } from "../config/index.js";
import {
  AnthropicClient,
  GeminiClient,
  GroqClient,
  OllamaClient,
  OpenAiClient,
} from "./clients/chat/index.js";
import { OpenAiEmbeddingClient } from "./clients/embedding/index.js";
import { ollamaSystemPrompt } from "./prompts/index.js";
import { EmbeddingClient, LlmClient } from "../types/app/index.js";
import {
  LlmUsageLimiterService,
  LlmUsageTrackerService,
} from "../cost/index.js";

/**
 * Limitador compartido por todos los clientes LLM.
 *
 * Permite controlar la cantidad total de llamadas reales
 * realizadas a los proveedores dentro de una ventana de tiempo.
 */
const usageLimiter = new LlmUsageLimiterService({
  maxRequests: config.llm_usage.maxRequest,
  windowMs: config.llm_usage.windowMs,
});

/**
 * Tracker compartido por todos los clientes.
 *
 * Permite registrar el consumo acumulado de requests
 * y tokens durante la ejecución de la aplicación.
 */
const usageTracker = new LlmUsageTrackerService();

/**
 * Crea una nueva instancia del cliente Anthropic.
 *
 * @return Cliente Anthropic configurado.
 */
export function createAnthropicClient(): LlmClient {
  return new AnthropicClient({
    apiKey: config.anthropicApiKey,
    model: config.anthropicModel,
    usageLimiter,
    usageTracker,
  });
}

/**
 * Crea una nueva instancia del cliente OpenAI.
 *
 * @return Cliente OpenAI configurado.
 */
export function createOpenAiClient(): LlmClient {
  return new OpenAiClient({
    apiKey: config.openaiApiKey,
    model: config.openaiModel,
    usageLimiter,
    usageTracker,
  });
}

/**
 * Crea una nueva instancia del cliente Gemini.
 *
 * @return Cliente Gemini configurado.
 */
export function createGeminiClient(): LlmClient {
  return new GeminiClient({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    usageLimiter,
    usageTracker,
  });
}

/**
 * Crea una nueva instancia del cliente Groq.
 *
 * @return Cliente Groq configurado.
 */
export function createGroqClient(): LlmClient {
  return new GroqClient({
    apiKey: config.groqApiKey,
    model: config.groqModel,
    usageLimiter,
    usageTracker,
  });
}

/**
 * Crea una nueva instancia del cliente Ollama.
 *
 * @return Cliente Ollama configurado.
 */
export function createOllamaClient(): LlmClient {
  return new OllamaClient({
    host: config.ollamaHost,
    model: config.ollamaModel,
    systemPrompt: ollamaSystemPrompt,
    think: false,
    keepAlive: "10m",
    temperature: 0,
    numCtx: 4096,
    usageLimiter,
    usageTracker,
  });
}

/**
 * Crea una nueva instancia del cliente de embeddings de OpenAI.
 *
 * Comparte el limiter y el tracker utilizados por los demás clientes.
 *
 * @return Cliente de embeddings configurado.
 */
export function createOpenAiEmbeddingClient(): EmbeddingClient {
  return new OpenAiEmbeddingClient(usageLimiter, usageTracker);
}

/**
 * Obtiene el limiter compartido utilizado por todos los clientes LLM.
 *
 * @return Limitador global de llamadas LLM.
 */
export function getLlmUsageLimiter(): LlmUsageLimiterService {
  return usageLimiter;
}

/**
 * Obtiene el tracker compartido utilizado por todos los clientes.
 *
 * @return Tracker global de consumo.
 */
export function getLlmUsageTracker(): LlmUsageTrackerService {
  return usageTracker;
}
