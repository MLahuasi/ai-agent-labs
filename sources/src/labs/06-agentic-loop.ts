import type { Interface } from "node:readline/promises";
import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";
import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/system.prompt.js";
import { TOOL_DEFINITIONS } from "../tools/definitions/index.js";
import { executeFileTool } from "../tools/executor/files-tools.executor.js";
import { LlmClient } from "../types/app/client.js";
import { GuardrailsService } from "../security/guardrails.service.js";
import { printHistory, printStats } from "../stats/index.js";
import { printLlmUsage } from "../cost/index.js";

/**
 * Inicia un chat interactivo con acceso a herramientas de archivos.
 *
 * @param llm Cliente LLM utilizado durante la conversación.
 * @return No retorna ningún valor.
 */
export async function startAgenticLoop(
  rl: Interface,
  llm: LlmClient,
  guardrails: GuardrailsService,
): Promise<void> {
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
  console.log("   Comandos: /clear, /stats, /tools, /usage, /history, /exit");
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

      if (userInput === "/usage") {
        printLlmUsage();
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

        const { text } = await conversation.sendChat(
          guardrailResult.sanitized,
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
  }
}
