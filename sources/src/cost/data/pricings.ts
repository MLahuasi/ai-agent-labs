/**
 * Precios de referencia en USD por 1 millón de tokens.
 *
 * Precios consultados en agosto de 2026.
 *
 * Los valores representan el precio estándar de API y se utilizan
 * para estimar el costo equivalente de cada ejecución.
 *
 * Gemini y Groq pueden ejecutarse utilizando sus capas gratuitas,
 * pero se conserva el precio comercial para poder comparar costos
 * entre proveedores.
 *
 * Ollama se ejecuta localmente, por lo que no tiene un costo API
 * por token. El valor 0 no contempla hardware, energía ni infraestructura.
 *
 * Fuentes:
 * Anthropic:
 * https://platform.claude.com/docs/en/about-claude/pricing
 *
 * OpenAI:
 * https://developers.openai.com/api/docs/pricing
 *
 * Gemini:
 * https://ai.google.dev/gemini-api/docs/pricing
 *
 * Groq:
 * https://console.groq.com/docs/models
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  // ============================================================
  // Anthropic - Claude
  // ============================================================

  // Modelos actuales
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 2.0, output: 10.0 },

  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0 },

  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },

  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },

  // ============================================================
  // OpenAI - GPT
  // ============================================================

  // GPT-5.6
  "gpt-5.6": { input: 5.0, output: 30.0 },
  "gpt-5.6-sol": { input: 5.0, output: 30.0 },
  "gpt-5.6-terra": { input: 2.0, output: 12.0 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },

  // GPT-5.4
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },

  // GPT-5
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },

  // GPT-4.1
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },

  // GPT-4o
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },

  // ============================================================
  // Google - Gemini
  // ============================================================

  // Gemini 3.x
  "gemini-3.7-flash": { input: 0.75, output: 3.75 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },

  // Gemini 2.5
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },

  // ============================================================
  // Groq
  // ============================================================

  // Modelos de producción
  "openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
  "openai/gpt-oss-20b": { input: 0.075, output: 0.3 },

  // Preview
  "qwen/qwen3.6-27b": { input: 0.6, output: 3.0 },

  // Seguridad
  "openai/gpt-oss-safeguard-20b": { input: 0.075, output: 0.3 },
  "meta-llama/llama-prompt-guard-2-22m": { input: 0.03, output: 0.03 },
  "meta-llama/llama-prompt-guard-2-86m": { input: 0.04, output: 0.04 },

  // Modelos retirados.
  // Se mantienen para calcular costos de resultados históricos.
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },

  // ============================================================
  // Ollama - ejecución local
  // ============================================================

  "llama3.2:3b": { input: 0, output: 0 },
  "hermes3:3b": { input: 0, output: 0 },
  "granite3.3:2b": { input: 0, output: 0 },

  "qwen2.5-coder:3b": { input: 0, output: 0 },
  "qwen2.5-coder:7b": { input: 0, output: 0 },

  // ============================================================
  // Embeddings - OpenAI
  // ============================================================

  // Los embeddings solo tienen costo de entrada.
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};
