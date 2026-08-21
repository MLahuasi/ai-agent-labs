import type { Interface } from "node:readline/promises";
import { config } from "../config/index.js";
import { Conversation } from "../chat/index.js";
import { DOCUMENTATION_ASSISTANT_PROMPT } from "../llm/prompts/system.prompt.js";
import { LlmClient } from "../types/app/index.js";
import { GuardrailsService } from "../security/guardrails.service.js";
import { printStats } from "../stats/index.js";
import { printLlmUsage } from "../cost/index.js";

/**
 * Inicia un chat interactivo por consola.
 *
 * @param llm Cliente LLM utilizado durante la conversación.
 * @return No retorna ningún valor.
 */
export async function startCLI(
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

  conversation.setAsk((request) => llm.stream(request));

  console.log("╔════════════════════════════════════════╗");
  console.log("║    Asistente de Documentación IA       ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log("   Comandos: /clear, /stats, /usage, /exit");
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

        // El cliente retorna el contenido completo generado.
        // La responsabilidad de mostrarlo pertenece al laboratorio.
        const response = await conversation.send(guardrailResult.sanitized);

        /**
         * El cliente de streaming ya imprime
         * los fragmentos recibidos.
         */
        process.stdout.write(response);
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
