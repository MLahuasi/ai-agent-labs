import { config, validateConfig } from "./config/index.js";
import { printLlmUsage } from "./cost/index.js";
import { createLlmProvider } from "./llm/llm.factory.js";
import { showMenu } from "./menu.js";
import { GuardrailsService } from "./security/guardrails.service.js";

async function main(): Promise<void> {
  validateConfig();
  const cli = createLlmProvider();
  if (!cli) throw new Error("No se declaró el cliente.");

  const { client: llm, model } = cli;

  const guardrails = new GuardrailsService({
    maxInputLength: config.guardrails.maxInputLength,

    rateLimit: {
      // Límite asociado a solicitudes iniciadas por el usuario.
      maxRequest: config.llm_usage.maxRequest,
      windowMs: config.llm_usage.windowMs,
    },
  });

  console.log("╔══════════════════════════╗");
  console.log("║        IA Agents         ║");
  console.log("╚══════════════════════════╝");
  console.log("");
  console.log("✅ Agente configurado correctamente");
  console.log("");
  console.log("📋 Configuración activa:");
  console.log(`   • Provider:       ${config.provider}`);
  console.log(`   • Modelo Actual: ${model} `);
  console.log(`   • Docs path: ${config.docsPath}      `);
  console.log(`   • RAG top-K: ${config.ragTopK}      `);
  console.log(`   • Numero max de Tokens: ${config.max_tokens}      `);
  console.log("");
  console.log("-".repeat(50));
  // Estado inicial de llamadas y consumo.
  printLlmUsage();
  console.log("-".repeat(50));

  await showMenu(llm, guardrails);
}

main().catch((error: Error) => console.error(" Error:", error.message));
