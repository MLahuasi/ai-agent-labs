import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";
import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/system.prompt.js";
import { TOOL_DEFINITIONS } from "../tools/definitions/index.js";
import { executeFileTool } from "../tools/executor/files-tools.executor.js";
import { LlmClient } from "../types/app/client.js";

/**
 * Inicia un chat interactivo con acceso a herramientas de archivos.
 *
 * @param llm Cliente LLM utilizado durante la conversación.
 * @return No retorna ningún valor.
 */
export async function startAgenticLoop(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
  });

  const conversation = new Conversation(DOCUMENTATION_ASSISTANT_PROMPT, {
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
    maxToolCalls: config.max_tool_calls,
  });

  conversation.setAsk((request) => llm.ask(request));

  console.log("╔════════════════════════════════╗");
  console.log("║    Agentic Loop with Tools     ║");
  console.log("╚════════════════════════════════╝");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log(
    `   Tengo acceso a ${TOOL_DEFINITIONS.length} tools: ` +
      `${TOOL_DEFINITIONS.map((tool) => tool.name).join(", ")}`,
  );
  console.log("   Comandos: /clear, /stats, /tools, /exit");
  console.log("");

  try {
    while (true) {
      const inputText = await rl.question("Tú: ");
      const userInput = inputText.trim();

      if (!userInput) {
        continue;
      }

      if (userInput === "/tools") {
        console.log(`\nTools disponibles (${TOOL_DEFINITIONS.length}):`);

        for (const tool of TOOL_DEFINITIONS) {
          const params = Object.keys(tool.input_schema.properties).join(", ");

          console.log(`   * ${tool.name}(${params})`);
          console.log(`     ${tool.description.split(".")[0]}.`);
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

        const { text } = await conversation.sendChat(
          userInput,
          TOOL_DEFINITIONS,
          executeFileTool,
        );

        process.stdout.write(text);
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
      `${conversation.estimateCurrentTokens()}`,
  );
  console.log(
    `   • Llamadas a tools en el último turno: ` +
      `${stats.toolCallsLastTurn}\n`,
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
