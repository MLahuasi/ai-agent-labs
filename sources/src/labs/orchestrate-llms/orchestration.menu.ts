import type { Interface } from "node:readline/promises";
import { Competitor } from "./types/compare.types.js";
import { config } from "../../config/index.js";
import {
  createAnthropicClient,
  createGeminiClient,
  createGroqClient,
  createOllamaClient,
  createOpenAiClient,
} from "../../llm/llm.instances.js";
import {
  compareLlmsUseCase,
  evaluatorUseCase,
  selectModelUseCase,
} from "./use-cases/index.js";
import { SelectableModel } from "./types/select-model.types.js";
import { GuardrailsService } from "../../security/guardrails.service.js";

/**
 * Crea los modelos LLM que participarán
 * como competidores en la comparación.
 *
 * Cada competidor recibe una nueva instancia
 * del cliente correspondiente.
 *
 * @return Lista de competidores configurados.
 */
function createCompetitors(): Competitor[] {
  return [
    {
      provider: "Anthropic",
      model: config.anthropicModel,
      client: createAnthropicClient(),
    },
    {
      provider: "OpenAI",
      model: config.openaiModel,
      client: createOpenAiClient(),
    },
    {
      provider: "Gemini",
      model: config.geminiModel,
      client: createGeminiClient(),
    },
    {
      provider: "Groq",
      model: config.groqModel,
      client: createGroqClient(),
    },
    {
      provider: "Ollama",
      model: config.ollamaModel,
      client: createOllamaClient(),
    },
  ];
}

/**
 * Inicia el submenú de casos de uso
 * relacionados con orquestación de LLMs.
 *
 * @param rl Interfaz de consola creada por el menú principal.
 * @return No retorna ningún valor.
 */
export async function startOrchestrationMenu(
  rl: Interface,
  guardrails: GuardrailsService,
): Promise<void> {
  while (true) {
    console.log("");
    console.log("╔════════════════════════════════╗");
    console.log("║       Orquestación LLMs        ║");
    console.log("╚════════════════════════════════╝");
    console.log("");
    console.log("1. Comparación de modelos");
    console.log("2. Evaluación automática");
    console.log("3. Selección dinámica de modelos");
    console.log("0. Volver");
    console.log("");

    const option = (await rl.question("Selecciona una opción: ")).trim();

    switch (option) {
      case "1": {
        // Crear nuevas instancias para esta ejecución.
        const competitors = createCompetitors();

        const questionGeneratorClient = createOpenAiClient();

        const judgeClient = createOpenAiClient();

        await compareLlmsUseCase(
          competitors,
          questionGeneratorClient,
          judgeClient,
        );

        break;
      }

      case "2": {
        // Crear clientes independientes para esta sesión.
        const askClient = createOpenAiClient();

        const evaluatorClient = createOpenAiClient();

        // Mantener el control dentro del caso de uso
        // hasta que el usuario utilice /exit.
        await evaluatorUseCase(rl, askClient, evaluatorClient, guardrails);

        break;
      }

      case "3": {
        // Modelo utilizado únicamente como router.
        const routerClient = createOpenAiClient();

        // Configurar qué modelo resolverá cada tipo de solicitud.
        const models: SelectableModel[] = [
          {
            task: "reasoning",
            provider: "OpenAI",
            model: config.openaiModel,
            client: createOpenAiClient(),
          },
          {
            task: "code",
            provider: "Groq",
            model: config.groqModel,
            client: createGroqClient(),
          },
          {
            task: "general",
            provider: "Ollama",
            model: config.ollamaModel,
            client: createOllamaClient(),
          },
        ];

        await selectModelUseCase(rl, routerClient, models, guardrails);

        break;
      }

      case "0":
        // Retornar al menú general sin cerrar readline.
        return;

      default:
        console.log("\n⚠️ Opción no válida.");
    }
  }
}
