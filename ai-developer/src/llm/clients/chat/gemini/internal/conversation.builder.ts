import { AgentRequest, Message } from "../../../../../types/agent/index.js";
import { type Content } from "@google/genai";
/**
 * Convierte el historial de mensajes interno
 * al formato esperado por Gemini.
 *
 * Mapeo de roles:
 * - user      -> user
 * - assistant -> model
 * - system    -> ignorado
 *
 * Si no se recibe historial, se construye
 * un único mensaje utilizando el prompt.
 */
export function buildContents({
  prompt,
  messages,
}: Pick<AgentRequest, "prompt" | "messages">): Content[] {
  if (!messages?.length) {
    return [
      {
        role: "user",
        parts: [{ text: prompt }],
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
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}
