import { config, validateConfig } from "./config/index.js";
import { createLlmProvider } from "./llm/llm.factory.js";
import { showMenu } from "./menu.js";

async function main(): Promise<void> {
  validateConfig();
  const cli = createLlmProvider();
  if (!cli) throw new Error("No se declaró el cliente.");

  const { client: llm, model } = cli;

  console.log("╔════════════════════════════════════════╗");
  console.log("║        DevAssistant - Curso IA         ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("✅ DevAssistant configurado correctamente");
  console.log("");
  console.log("📋 Configuración activa:");
  console.log(`   • Provider:       ${config.provider}`);
  console.log(`   • Modelo Actual: ${model} `);
  console.log(`   • Docs path: ${config.docsPath}      `);
  console.log(`   • RAG top-K: ${config.ragTopK}      `);
  console.log(`   • Numero max de Tokens: ${config.max_tokens}      `);
  console.log("");
  console.log("-".repeat(50));
  await showMenu(llm);
}

main().catch((error: Error) => console.error(" Error:", error.message));
