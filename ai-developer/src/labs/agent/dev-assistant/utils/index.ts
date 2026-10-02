import { Conversation } from "../../../../chat/index.js";

/**
 * Imprime un separador visual en consola.
 *
 * Se utiliza para distinguir claramente la salida de cada escenario
 * durante la ejecución secuencial de la aplicación.
 */
export function logSeparator(): void {
  console.log("\n" + "═".repeat(60) + "\n");
}

/**
 * Imprime la información descriptiva de un escenario.
 *
 * @param scenarioNumber Número identificador del escenario.
 * @param title Título breve del escenario.
 * @param description Descripción del objetivo o comportamiento que se desea demostrar.
 */
export function printScenarioDetails(
  scenarioNumber: number,
  title: string,
  description: string,
): void {
  // Muestra el encabezado principal del escenario.
  console.log(`ESCENARIO ${scenarioNumber}: ${title}`);

  // Imprime una breve descripción para contextualizar la ejecución.
  console.log(`   ${description}`);

  // Agrega una línea en blanco para mejorar la legibilidad en consola.
  console.log("");
}

/**
 * Imprime estadísticas de uso de la conversación.
 *
 * Permite visualizar métricas relevantes de la última interacción con el agente,
 * como tokens de entrada, tokens de salida y cantidad de tools ejecutadas.
 *
 * @param conversation Instancia de la conversación de la cual se obtendrán
 * las estadísticas acumuladas.
 */
export function printStats(conversation: Conversation): void {
  // Obtiene las métricas actuales de la conversación.
  const stats = conversation.getStats();

  // Muestra un resumen compacto del consumo de tokens y uso de herramientas.
  console.log(
    `\nStats: ${stats.inputTokens} tokens entrada | ` +
      `${stats.outputTokens} tokens salida | ` +
      `Tools usadas: ${stats.toolCallsLastTurn}`,
  );
}

/**
 * Pausa temporalmente la ejecución entre escenarios.
 *
 * Esta espera ayuda a reducir la probabilidad de alcanzar límites de frecuencia
 * cuando se realizan varias solicitudes consecutivas al modelo o a servicios externos.
 *
 * @param ms Duración de la pausa en milisegundos. Por defecto, 800 ms.
 */
export async function pauseExecution(ms: number = 800): Promise<void> {
  // Crea una promesa que se resuelve después del tiempo indicado.
  await new Promise((resolve) => setTimeout(resolve, ms));
}
