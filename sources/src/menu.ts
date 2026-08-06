import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  codeReview,
  simpleCall,
  startAgenticLoop,
  startCLI,
  startRagAgent,
  streamingResponse,
  systemPrompt,
} from "./labs/index.js";

import { LlmClient } from "./types/app/index.js";

export async function showMenu(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({ input, output });

  console.log("Seleccione un laboratorio:");
  console.log("1. Simple Call");
  console.log("2. System Prompt");
  console.log("3. Streaming Response");
  console.log("4. Chat");
  console.log("5. Read file and call LLM");
  console.log("6. Agentic Loop");
  console.log("7. Agente con RAG");
  console.log("0. Salir");

  const option = await rl.question("\nOpción: ");

  switch (option.trim()) {
    case "1":
      await simpleCall(llm);
      break;

    case "2":
      await systemPrompt(llm);
      break;

    case "3":
      await streamingResponse(llm);
      break;

    case "4":
      /**
       * Se cierra el readline del menú antes de iniciar
       * el readline propio del chat.
       *
       * Esto evita tener dos interfaces leyendo
       * simultáneamente desde process.stdin.
       */
      rl.close();
      await startCLI(llm);
      return;

    case "5":
      await codeReview(llm);
      break;

    case "6":
      rl.close();
      await startAgenticLoop(llm);
      return;

    case "7":
      rl.close();
      await startRagAgent(llm);
      return;

    case "0":
      console.log("Hasta luego 👋");
      break;

    default:
      console.log("Opción inválida");
  }

  rl.close();
}
