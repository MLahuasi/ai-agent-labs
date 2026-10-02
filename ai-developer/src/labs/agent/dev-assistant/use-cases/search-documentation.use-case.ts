import { Conversation } from "../../../../chat/index.js";
import { hasAvailableLlmRequests } from "../../../../cost/index.js";
import { GuardrailsService } from "../../../../security/guardrails.service.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools/index.js";
import { printScenarioDetails, printStats } from "../utils/index.js";

/**
 * Escenario 2: Búsqueda en documentación mediante RAG.
 *
 * Demuestra cómo el agente puede consultar documentación previamente ingerida
 * utilizando la herramienta `search_docs`.
 *
 * Si no existe documentación disponible en el índice, el agente debe manejar
 * el caso correctamente e indicar que no encontró información relevante.
 *
 * @param conversation Conversación activa utilizada para enviar el prompt,
 * ejecutar herramientas y consultar las estadísticas del turno.
 */
export async function searchDocumentationUseCase(
  conversation: Conversation,
  guardrails: GuardrailsService,
): Promise<void> {
  // Verificar que exista capacidad suficiente antes
  // de iniciar la ejecución del laboratorio.
  if (!hasAvailableLlmRequests(2)) {
    return;
  }
  // Muestra en consola la información descriptiva del escenario que se ejecutará.
  printScenarioDetails(
    2,
    "Búsqueda en documentación",
    "El agente usa search_docs para encontrar información en los docs ingestados",
  );

  // Pregunta diseñada para requerir información específica de la documentación
  // y favorecer que el agente utilice `search_docs` en lugar de responder
  // únicamente con conocimiento general.
  const question =
    "¿Cómo se autentican las peticiones a la API según la documentación?";

  // Validar el prompt antes de enviarlo al LLM.
  const guardrailResult = guardrails.checkInput(question);

  if (!guardrailResult.safe) {
    guardrails.printResult("", question, guardrailResult);
  } else {
    console.log(`Usuario: ${guardrailResult.sanitized}\n`);
    console.log("Robotitus: ");

    // Envía la consulta al agente junto con las herramientas disponibles.
    // `executeTool` será invocado cuando el modelo decida ejecutar una herramienta,
    // como `search_docs`, para recuperar información del índice documental.
    const { text } = await conversation.sendChat(
      guardrailResult.sanitized,
      TOOL_DEFINITIONS,
      executeTool,
    );

    // Imprime la respuesta final generada por el agente después de completar
    // cualquier llamada a herramientas requerida durante el turno.
    process.stdout.write(text);
    process.stdout.write("\n\n");

    // Obtiene las herramientas utilizadas específicamente durante el último turno.
    const toolsUsed = conversation.getToolsUsedLastTurn();

    if (toolsUsed.length > 0) {
      // Permite verificar qué herramientas decidió utilizar el agente
      // para resolver la consulta.
      console.log(`\n🔧 Tools usadas: ${toolsUsed.join(", ")}`);
    } else {
      // Si no se utilizó ninguna herramienta, recuerda cómo cargar documentación
      // para poder probar el flujo RAG mediante `search_docs`.
      console.log(
        "\nTip: Ejecuta npm run ingest para cargar documentación y probar search_docs",
      );
    }

    // Muestra las métricas acumuladas de la conversación y de la ejecución
    // del escenario.
    printStats(conversation);
  }
}
