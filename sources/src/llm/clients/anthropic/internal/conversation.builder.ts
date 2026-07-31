import Anthropic from "@anthropic-ai/sdk";
import { Message } from "../../../../types/agent/index.js";
/**
 * Construye la lista de mensajes esperada
 * por Anthropic.
 *
 * Los mensajes con rol "system" se excluyen
 * porque Anthropic recibe las instrucciones
 * de sistema mediante la propiedad "system"
 * y no dentro del historial.
 *
 * Si no se recibe historial, se construye
 * un único mensaje utilizando el prompt.
 *
 * @param prompt Mensaje que se envía al llm.
 * @param messages Historial de la conversación
 * @returns Historial de la conversación
 */
export function buildMessages(
  prompt: string,
  messages?: Message[],
): Anthropic.Messages.MessageParam[] {
  if (!messages?.length) {
    return [
      {
        role: "user",
        content: prompt,
      },
    ];
  }

  return messages
    .filter(
      (
        message,
      ): message is Message & {
        role: "user" | "assistant";
      } => message.role !== "system",
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}
