import OpenAI from "openai";
import { AgentRequest, Message } from "../../../../types/agent/index.js";
/**
 * Construye la lista de mensajes que será
 * enviada al modelo.
 *
 * Si existe un historial de conversación,
 * se utiliza dicho historial.
 *
 * En caso contrario, se crea una conversación
 * mínima utilizando únicamente el prompt actual.
 */
export function buildInput({
  prompt,
  messages,
}: AgentRequest): OpenAI.Responses.ResponseInputItem[] {
  if (!messages?.length) {
    return [{ role: "user", content: prompt }];
  }
  return messages
    .filter(
      (message): message is Message & { role: "user" | "assistant" } =>
        message.role !== "system",
    )
    .map((message) => ({ role: message.role, content: message.content }));
}
