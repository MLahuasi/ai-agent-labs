import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { simpleCall, streamingResponse, systemPrompt } from "./labs/index.js";
import { LlmClient } from "./llm/interfaces/index.js";

export async function showMenu(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({ input, output });

  console.log("Seleccione un laboratorio:");
  console.log("1. Simple Call");
  console.log("2. System Prompt");
  console.log("3. Streaming Response");
  console.log("0. Salir");

  const option = await rl.question("\nOpción: ");

  switch (option) {
    case "1":
      await simpleCall(llm);
      break;

    case "2":
      await systemPrompt(llm);
      break;

    case "3":
      await streamingResponse(llm);
      break;

    case "0":
      console.log("Hasta luego 👋");
      break;

    default:
      console.log("Opción inválida");
  }

  rl.close();
}
