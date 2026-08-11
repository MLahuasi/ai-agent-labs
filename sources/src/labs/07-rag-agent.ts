import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LlmClient } from "../types/app/index.js";
import { RagPromptService } from "../rag/services/rag-prompt.service.js";
import { runIngest } from "../rag/ingest/ingest.js";
import { config } from "../config/index.js";
import { Conversation } from "../chat/index.js";
import { Message } from "../types/agent/index.js";
import { ChunkingFileExtension } from "../rag/services/index.js";

const RAG_SYSTEM_PROMPT = `Eres DevAssistant, un asistente de documentación técnica.
Tu trabajo es responder preguntas basándote ÚNICAMENTE en la documentación que se te proporciona como contexto.

Reglas importantes:
1. Si la información está en el contexto: responde citando la fuente (nombre del archivo y sección)
2. Si la información NO está en el contexto: di claramente "No tengo esa información en la documentación disponible"
3. Nunca inventes datos técnicos, versiones, endpoints, o configuraciones
4. Usa markdown para formatear tu respuesta (código, listas, encabezados)
5. Sé conciso y directo — los developers prefieren respuestas específicas`;

const RAG_INSTRUCTIONS = `
Basándote únicamente en el contexto anterior, responde la siguiente pregunta.
Si la información no está disponible en el contexto, indícalo claramente.
Cita el archivo y la sección utilizados cuando sea posible.
`;

/**
 * Ejecuta una revisión de código utilizando streaming.
 */
export async function startRagAgent(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
  });
  const conversation = new Conversation(RAG_SYSTEM_PROMPT);
  conversation.setAsk(({ prompt, systemPrompt, messages }) =>
    llm.stream({
      prompt,
      systemPrompt,
      messages,
    }),
  );

  console.log("╔══════════════════════╗");
  console.log("║      Rag Agent       ║");
  console.log("╚══════════════════════╝");

  console.log("✅ Demo 1: Consulta Agente con RAG");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log("💡 Tip: usa /ingest para cargar documentación");
  console.log("   Comandos: /ingest [path], /clear, /stats, /tools, /exit");
  console.log("");

  try {
    let messages: Message[] | undefined = undefined;
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
          const err = error as Error;
          console.error(`\nError durante la ingestión: ${err.message}`);
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
        const stats = conversation.getStats();
        console.log(`\n📊 Estadísticas de la conversación:`);
        console.log(`   • Turnos: ${stats.turns}`);
        console.log(`   • Tokens de entrada acumulados: ${stats.inputTokens}`);
        console.log(`   • Tokens de salida acumulados: ${stats.outputTokens}`);
        console.log(
          `   • Tokens estimados en contexto actual: ${conversation.estimateCurrentTokens()}\n`,
        );
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

        const { messages: chat } = await conversation.sendChat(
          ragPrompt,
          undefined,
          messages,
        );

        messages = chat;

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
