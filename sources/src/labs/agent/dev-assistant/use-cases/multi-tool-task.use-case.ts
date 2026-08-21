import { Conversation } from "../../../../chat/index.js";
import { hasAvailableLlmRequests } from "../../../../cost/index.js";
import { GuardrailsService } from "../../../../security/guardrails.service.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools/index.js";
import { printScenarioDetails, printStats } from "../utils/index.js";

/**
 * Escenario 3: Tarea multi-tool.
 *
 * Demuestra cómo el agente puede encadenar varias herramientas dentro de un
 * mismo turno para completar una tarea que requiere más de una operación.
 *
 * En este escenario, el agente primero debe listar los archivos disponibles
 * mediante `list_files` y luego utilizar `read_file` para inspeccionar el
 * archivo que contiene el system prompt.
 *
 * @param conversation Conversación activa utilizada para enviar el prompt,
 * ejecutar herramientas y consultar las estadísticas del turno.
 */
export async function multiToolTaskUseCase(
  conversation: Conversation,
  guardrails: GuardrailsService,
): Promise<void> {
  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(3)) {
    return;
  }

  // Muestra en consola la información descriptiva del escenario que se ejecutará.
  printScenarioDetails(
    3,
    "Tarea multi-tool",
    "El agente encadena list_files + read_file para completar una tarea",
  );

  // La consulta requiere dos pasos relacionados:
  // 1. Inspeccionar los archivos disponibles dentro de `src/agent`.
  // 2. Identificar y leer el archivo que contiene el system prompt del agente.
  //
  // Esto permite validar que el agente pueda utilizar el resultado de una
  // herramienta como contexto para decidir cuál herramienta ejecutar después.
  const question =
    "Lista los archivos que hay en src/labs/agent y luego lee el contenido del system prompt del agente.";
  // Validar el prompt antes de enviarlo al LLM.
  const guardrailResult = guardrails.checkInput(question);

  if (!guardrailResult.safe) {
    guardrails.printResult("", question, guardrailResult);
  } else {
    console.log(`Usuario: ${guardrailResult.sanitized}\n`);
    console.log("Robotitus: ");

    // Envía la consulta al agente junto con las definiciones de las herramientas.
    // `executeTool` será invocado cada vez que el modelo solicite ejecutar una tool.
    //
    // Para resolver correctamente este escenario se espera que el agente pueda
    // encadenar herramientas como `list_files` y `read_file` dentro del mismo turno.
    const { text } = await conversation.sendChat(
      guardrailResult.sanitized,
      TOOL_DEFINITIONS,
      executeTool,
    );

    // Imprime la respuesta final generada una vez que el agente haya completado
    // las llamadas a herramientas necesarias para resolver la tarea.
    process.stdout.write(text);
    process.stdout.write("\n\n");

    // Obtiene las herramientas utilizadas durante el último turno para poder
    // verificar el flujo multi-tool ejecutado por el agente.
    const toolsUsed = conversation.getToolsUsedLastTurn();

    if (toolsUsed.length > 0) {
      // Muestra el orden de las herramientas utilizadas, lo que facilita validar
      // que el agente haya encadenado correctamente las operaciones esperadas.
      console.log(`\n🔧 Tools usadas: ${toolsUsed.join(", ")}`);
    }

    // Muestra las métricas acumuladas de la conversación y de la ejecución
    // del escenario.
    printStats(conversation);
  }
}
