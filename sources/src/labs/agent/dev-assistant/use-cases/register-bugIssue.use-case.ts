import { Conversation } from "../../../../chat/index.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools/index.js";
import { printScenarioDetails, printStats } from "../utils/index.js";

/**
 * Escenario 4: Crear un issue.
 *
 * Demuestra cómo el agente puede ejecutar una herramienta con efectos de lado
 * reales mediante `create_issue`.
 *
 * A diferencia de escenarios puramente consultivos, esta operación modifica
 * el estado del sistema al crear un archivo persistente dentro de `./issues/`.
 *
 * @param conversation Conversación activa utilizada para enviar el prompt,
 * ejecutar herramientas y consultar las estadísticas del turno.
 */
export async function registerBugIssueUseCase(
  conversation: Conversation,
): Promise<void> {
  // Muestra en consola la información descriptiva del escenario que se ejecutará.
  printScenarioDetails(
    4,
    "Crear un issue",
    "El agente usa create_issue para registrar una tarea en ./issues/",
  );

  // Define una solicitud suficientemente detallada para que el agente pueda
  // construir un issue de tipo bug con contexto, comportamiento esperado,
  // etiquetas y prioridad.
  //
  // El objetivo es validar que el agente interprete correctamente la intención
  // del usuario y transforme la descripción en los argumentos requeridos por
  // la herramienta `create_issue`.
  const question =
    "Crea un issue de tipo bug: el vector store falla silenciosamente cuando " +
    "DB_PATH apunta a un directorio que no existe. Debería lanzar un error claro " +
    "en lugar de crear la base de datos en una ubicación inesperada. " +
    "Etiquetas: bug, rag. Prioridad: high.";

  console.log(`Usuario: ${question}\n`);
  console.log("Robotitus: ");

  // Envía la consulta al agente junto con las definiciones de las herramientas.
  // `executeTool` será invocado cuando el modelo decida ejecutar `create_issue`.
  //
  // Este escenario permite comprobar que el agente puede realizar una acción
  // con efecto de lado y posteriormente comunicar al usuario el resultado
  // de la operación realizada.
  const { text } = await conversation.sendChat(
    question,
    TOOL_DEFINITIONS,
    executeTool,
  );

  // Imprime la respuesta final generada por el agente después de ejecutar
  // las herramientas necesarias para completar la solicitud.
  process.stdout.write(text);
  process.stdout.write("\n\n");

  // Obtiene las herramientas utilizadas durante el último turno para verificar
  // que el agente haya recurrido a `create_issue` para registrar el bug.
  const toolsUsed = conversation.getToolsUsedLastTurn();

  if (toolsUsed.length > 0) {
    // Muestra las herramientas utilizadas durante la ejecución del escenario.
    console.log(`\n🔧 Tools usadas: ${toolsUsed.join(", ")}`);
  }

  // Muestra las métricas acumuladas de la conversación y de la ejecución
  // del escenario.
  printStats(conversation);
}
