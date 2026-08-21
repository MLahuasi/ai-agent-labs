import type { Interface } from "node:readline/promises";
import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";
import { RAG_INSTRUCTIONS, RAG_SYSTEM_PROMPT } from "../llm/prompts/index.js";
import { RagPromptService } from "../rag/services/rag-prompt.service.js";
import { runIngest } from "../rag/ingest/ingest.js";
import { ChunkingFileExtension } from "../rag/services/index.js";
import { LlmClient } from "../types/app/index.js";
import { GuardrailsService } from "../security/guardrails.service.js";
import { printHistory, printStats } from "../stats/index.js";
import { printLlmUsage } from "../cost/index.js";

/**
 * Inicia un chat interactivo con recuperación de contexto mediante RAG.
 *
 * @param llm Cliente LLM utilizado durante la conversación.
 * @return No retorna ningún valor.
 */
export async function startRagAgent(
  rl: Interface,
  llm: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
  const conversation = new Conversation(RAG_SYSTEM_PROMPT, {
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
    maxToolCalls: config.max_tool_calls,
  });

  conversation.setAsk((request) =>
    llm.stream({
      ...request,
      onChunk: (chunk) => {
        process.stdout.write(chunk);
      },
    }),
  );

  console.log("╔══════════════════════════════════╗");
  console.log("║      Agentic Loop with RAG       ║");
  console.log("╚══════════════════════════════════╝");

  console.log("✅ Demo 1: Consulta Agente con RAG");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log("💡 Tip: usa /ingest para cargar documentación");
  console.log(
    "   Comandos: /ingest [path], /clear, /stats, /usage, /history, /exit",
  );
  console.log("");

  try {
    while (true) {
      const inputText = await rl.question("Tú: ");
      const userInput = inputText.trim();

      if (!userInput) {
        continue;
      }

      if (userInput.startsWith("/ingest")) {
        const inputParts = userInput.split(" ");
        const docsDirectory = inputParts[1] ?? config.docsPath;

        try {
          await runIngest(
            docsDirectory,
            config.separator,
            config.extention as ChunkingFileExtension,
            config.targetChunkSize,
            config.chunkSizeTolerance,
          );

          console.log("\nIngesta completada correctamente.\n");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error desconocido";

          console.error(`\nError durante la ingestión: ${message}`);
        }

        console.log("");
        continue;
      }

      if (userInput === "/clear") {
        conversation.clear();
        console.log("");
        continue;
      }

      if (userInput === "/stats") {
        printStats(conversation);
        continue;
      }

      if (userInput === "/usage") {
        printLlmUsage();
        continue;
      }

      if (userInput === "/history") {
        printHistory(conversation);
        continue;
      }

      if (userInput === "/exit" || userInput === "/salida") {
        const stats = conversation.getStats();

        console.log(
          `\nResumen: ${stats.turns} turnos, ` +
            `${stats.inputTokens} tokens de entrada, ` +
            `${stats.outputTokens} tokens de salida.`,
        );

        break;
      }

      const guardrailResult = guardrails.checkInput(userInput);

      if (!guardrailResult.safe) {
        guardrails.printResult("", userInput, guardrailResult);
        continue;
      }

      try {
        process.stdout.write("\nAsistente: ");

        const ragAgent = new RagPromptService();

        const ragPrompt = await ragAgent.buildRagPrompt(
          guardrailResult.sanitized,
          RAG_INSTRUCTIONS,
        );

        await conversation.sendChat(ragPrompt);

        /**
         * El cliente de streaming imprime directamente
         * los fragmentos recibidos.
         */

        process.stdout.write("\n\n");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";

        console.error(`\nError: ${message}\n`);
      }
    }
  } finally {
  }
}
