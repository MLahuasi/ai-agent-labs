import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { Conversation } from "../chat/index.js";
import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/system.prompt.js";
import { LlmClient } from "../types/app/index.js";

export async function startCLI(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
  });

  const conversation = new Conversation(DOCUMENTATION_ASSISTANT_PROMPT);

  conversation.setAsk(({ prompt, systemPrompt, messages }) =>
    llm.stream({
      prompt,
      systemPrompt,
      messages,
    }),
  );

  console.log("╔════════════════════════════════════════╗");
  console.log("║    Asistente de Documentación IA       ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log("   Comandos: /clear, /stats, /exit");
  console.log("");

  try {
    while (true) {
      const inputText = await rl.question("Tú: ");
      const userInput = inputText.trim();

      if (!userInput) {
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

        await conversation.send(userInput);

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
