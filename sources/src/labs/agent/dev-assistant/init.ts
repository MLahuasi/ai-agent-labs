import { Conversation } from "../../../chat/conversation.js";
import { config } from "../../../config/index.js";
import { LlmClient } from "../../../types/app/index.js";
import { AGENT_SYSTEM_PROMPT } from "./prompts/system-prompt.js";
import {
  exploreCodeUseCase,
  multiToolTaskUseCase,
  registerBugIssueUseCase,
  searchDocumentationUseCase,
} from "./use-cases/index.js";
import { logSeparator, pauseExecution } from "./utils/index.js";

export async function starAgent(llm: LlmClient): Promise<void> {
  console.log("");
  console.log("╔═══════════════╗");
  console.log("║     Agent     ║");
  console.log("╚═══════════════╝");
  console.log("");
  console.log(
    "En este flujo se ejecutan 4 escenarios para mostrar las capacidades",
  );
  console.log("del Agente sin necesidad de input del usuario.");

  const conversation = new Conversation(AGENT_SYSTEM_PROMPT, {
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
    maxToolCalls: config.max_tool_calls,
  });

  conversation.setAsk((request) => llm.stream(request));

  // Escenario 1
  logSeparator();
  await exploreCodeUseCase(conversation);
  conversation.clear();
  await pauseExecution();

  // Escenario 2
  logSeparator();
  await searchDocumentationUseCase(conversation);
  conversation.clear();
  await pauseExecution();

  // Escenario 3
  logSeparator();
  await multiToolTaskUseCase(conversation);
  conversation.clear();
  await pauseExecution();

  // Escenario 4
  logSeparator();
  await registerBugIssueUseCase(conversation);
  conversation.clear();
  await pauseExecution();

  // Resumen final
  logSeparator();
  console.log("Agente completado exitosamente");
  console.log("");
  console.log("Próximos pasos:");
  console.log("  npm run dev       — Prueba el agente de forma interactiva");
  console.log(
    "  npm run ingest    — Carga documentación para usar search_docs",
  );
  console.log("  ls ./issues/      — Revisa el issue creado en el escenario 4");
  console.log("");
}
