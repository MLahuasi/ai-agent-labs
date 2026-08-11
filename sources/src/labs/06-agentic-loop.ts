import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Conversation } from "../chat/index.js";
import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/system.prompt.js";
import { TOOL_DEFINITIONS } from "../tools/definitions/index.js";
import { LlmClient } from "../types/app/client.js";
import { Message } from "../types/agent/index.js";

export async function startAgenticLoop(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
  });

  const conversation = new Conversation(DOCUMENTATION_ASSISTANT_PROMPT);
  conversation.setAsk(({ prompt, systemPrompt, messages, tools }) =>
    llm.ask({
      prompt,
      systemPrompt,
      messages,
      tools,
    }),
  );

  console.log("╔════════════════════════╗");
  console.log("║    Agentic Loop IA     ║");
  console.log("╚════════════════════════╝");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log(
    `   Tengo acceso a ${TOOL_DEFINITIONS.length} tools: ${TOOL_DEFINITIONS.map((t) => t.name).join(", ")}`,
  );
  console.log("   Comandos: /clear, /stats, /tools, /exit");
  console.log("");

  try {
    let messages: Message[] | undefined = undefined;
    while (true) {
      const inputText = await rl.question("Tú: ");
      const userInput = inputText.trim();

      if (!userInput) {
        continue;
      }

      if (userInput === "/tools") {
        conversation.clear();
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

        const { messages: chat, text } = await conversation.sendChat(
          userInput,
          TOOL_DEFINITIONS,
          messages,
        );

        messages = chat;

        process.stdout.write(text);
        process.stdout.write("\n\n");

        // let res = await FileSystemUtils.searchFile({
        //   searchText: "config.ts",
        //   file_extension: ".ts",
        //   // path: "src/",
        // });

        // console.log(res);

        /**
         * El cliente de streaming ya imprime
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
