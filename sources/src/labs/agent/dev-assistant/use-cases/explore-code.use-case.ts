import { Conversation } from "../../../../chat/index.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools/index.js";
import { printScenarioDetails, printStats } from "../utils/index.js";

/**
 * Escenario 1: Exploración de código.
 *
 * Demuestra cómo el agente puede inspeccionar el código fuente del proyecto
 * utilizando herramientas como `read_file` o `search_code` antes de responder.
 *
 * @param conversation Conversación activa utilizada para enviar el prompt,
 * ejecutar herramientas y consultar las estadísticas del turno.
 */
export async function exploreCodeUseCase(
  conversation: Conversation,
): Promise<void> {
  // Muestra en consola la información descriptiva del escenario que se ejecutará.
  printScenarioDetails(
    1,
    "Exploración de código",
    "El agente lee un archivo del proyecto para responder sobre sus exports",
  );

  // Pregunta diseñada para obligar al agente a inspeccionar el archivo
  // en lugar de responder únicamente con conocimiento previo.
  const question =
    "¿Qué funciones y valores exporta el archivo src/rag/store/retriever.ts?";

  console.log(`Usuario: ${question}\n`);
  console.log("Robotitus: ");

  // Envía la consulta al agente y habilita el uso de las herramientas disponibles.
  // `executeTool` será invocado cuando el modelo decida ejecutar alguna herramienta.
  const { text } = await conversation.sendChat(
    question,
    TOOL_DEFINITIONS,
    executeTool,
  );

  // Imprime la respuesta generada por el agente.
  process.stdout.write(text);
  process.stdout.write("\n\n");

  // Muestra únicamente las herramientas utilizadas durante el último turno.
  const toolsUsed = conversation.getToolsUsedLastTurn();

  if (toolsUsed.length > 0) {
    console.log(`\n🔧 Tools usadas: ${toolsUsed.join(", ")}`);
  }

  // Imprime métricas de la conversación, como uso de tokens o información
  // relacionada con la ejecución del escenario.
  printStats(conversation);
}
