import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";
import { RAG_INSTRUCTIONS, RAG_SYSTEM_PROMPT } from "../llm/prompts/index.js";
import { RagPromptService } from "../rag/services/rag-prompt.service.js";
import { runIngest } from "../rag/ingest/ingest.js";
import { ChunkingFileExtension } from "../rag/services/index.js";
import { LlmClient } from "../types/app/index.js";

/**
 * Inicia un chat interactivo con recuperación de contexto mediante RAG.
 *
 * @param llm Cliente LLM utilizado durante la conversación.
 * @return No retorna ningún valor.
 */
export async function startRagAgent(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
  });

  const conversation = new Conversation(RAG_SYSTEM_PROMPT, {
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
    maxToolCalls: config.max_tool_calls,
  });

  conversation.setAsk((request) => llm.stream(request));

  console.log("╔══════════════════════════════════╗");
  console.log("║      Agentic Loop with RAG       ║");
  console.log("╚══════════════════════════════════╝");

  console.log("✅ Demo 1: Consulta Agente con RAG");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log("💡 Tip: usa /ingest para cargar documentación");
  console.log("   Comandos: /ingest [path], /clear, /stats, /history, /exit");
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

      try {
        process.stdout.write("\nAsistente: ");

        const ragAgent = new RagPromptService();

        const ragPrompt = await ragAgent.buildRagPrompt(
          userInput,
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
    rl.close();
  }
}

/**
 * Imprime las estadísticas actuales de una conversación.
 *
 * @param conversation Conversación utilizada para obtener las estadísticas.
 * @return No retorna ningún valor.
 */
function printStats(conversation: Conversation): void {
  const stats = conversation.getStats();

  console.log("\n📊 Estadísticas de la conversación:");
  console.log(`   • Turnos: ${stats.turns}`);
  console.log(`   • Tokens de entrada acumulados: ${stats.inputTokens}`);
  console.log(`   • Tokens de salida acumulados: ${stats.outputTokens}`);
  console.log(
    `   • Tokens estimados en contexto actual: ` +
      `${conversation.estimateCurrentTokens()}\n`,
  );
}

/**
 * Imprime el historial completo de la conversación.
 *
 * @param conversation Conversación utilizada para obtener el historial.
 * @return No retorna ningún valor.
 */
function printHistory(conversation: Conversation): void {
  const history = conversation.getHistory();

  console.log("\n📜 Historial de la conversación:");

  if (history.length === 0) {
    console.log("   No hay mensajes registrados.\n");
    return;
  }

  for (const message of history) {
    const role =
      message.role === "user"
        ? "Tú"
        : message.role === "assistant"
          ? "Asistente"
          : message.role;

    console.log(`\n${role}:`);
    console.log(message.content);
  }

  console.log("");
}
