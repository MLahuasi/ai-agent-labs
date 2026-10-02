import { Conversation } from "../chat/index.js";

/**
 * Imprime las estadísticas actuales de una conversación.
 *
 * @param conversation Conversación utilizada para obtener las estadísticas.
 * @return No retorna ningún valor.
 */
export function printStats(conversation: Conversation): void {
  const stats = conversation.getStats();

  console.log("\n📊 Estadísticas de la conversación:");
  console.log(`   • Turnos: ${stats.turns}`);
  console.log(`   • Tokens de entrada acumulados: ${stats.inputTokens}`);
  console.log(`   • Tokens de salida acumulados: ${stats.outputTokens}`);
  console.log(
    `   • Tokens estimados en contexto actual: ` +
      `${conversation.estimateCurrentTokens()}`,
  );
  console.log(
    `   • Llamadas a tools en el último turno: ${stats.toolCallsLastTurn}\n`,
  );
}

/**
 * Imprime el historial completo de la conversación.
 *
 * @param conversation Conversación utilizada para obtener el historial.
 * @return No retorna ningún valor.
 */
export function printHistory(conversation: Conversation): void {
  const history = conversation.getHistory();

  console.log("\n📜 Historial de la conversación:");

  if (history.length === 0) {
    console.log("   No hay mensajes registrados.\n");
    return;
  }

  for (const message of history) {
    const role =
      message.role === "user"
        ? "Tú"
        : message.role === "assistant"
          ? "Asistente"
          : message.role;

    console.log(`\n${role}:`);
    console.log(message.content);
  }

  console.log("");
}
