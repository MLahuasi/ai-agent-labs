import { config, validateConfig } from "../../../config/index.js";
import { createLlmProvider } from "../../../llm/llm.factory.js";
import { starAgent } from "./init.js";

try {
  validateConfig();
  const cli = createLlmProvider();
  if (!cli) throw new Error("No se declaró el cliente.");

  const { client: llm, model } = cli;
  console.log("╔═══════════════╗");
  console.log("║     Agent     ║");
  console.log("╚═══════════════╝");
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
  await starAgent(llm);
} catch (error) {
  const message = error instanceof Error ? error.message : "Error desconocido";

  console.error(`Error durante la ejecución del llm: ${message}`);
  process.exitCode = 1;
}
