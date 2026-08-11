import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { AgentRequest, Message } from "../../../../../types/agent/index.js";
import { toGroqMessage } from "./message.mapper.js";

function removeDuplicatedCurrentPrompt(
  history: Message[],
  prompt: string,
): void {
  const lastMessage = history.at(-1);

  if (
    lastMessage?.role === "user" &&
    lastMessage.content.trim() === prompt.trim()
  ) {
    history.pop();
  }
}

export function buildConversation({
  prompt,
  systemPrompt,
  messages,
}: AgentRequest): ChatCompletionMessageParam[] {
  const history = [...(messages ?? [])];

  removeDuplicatedCurrentPrompt(history, prompt);

  const historySystemMessage = history.find(
    (message) => message.role === "system",
  );

  const conversationHistory = history.filter(
    (message) => message.role !== "system",
  );

  const resolvedSystemPrompt =
    systemPrompt?.trim() || historySystemMessage?.content.trim() || undefined;

  return [
    ...(resolvedSystemPrompt
      ? [
          {
            role: "system" as const,
            content: resolvedSystemPrompt,
          },
        ]
      : []),

    ...conversationHistory.map((message) => toGroqMessage(message)),

    {
      role: "user",
      content: prompt,
    },
  ];
}
