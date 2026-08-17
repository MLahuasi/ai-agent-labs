import { Message as OllamaMessage } from "ollama";
import { toOllamaMessage } from "./message.mapper.js";
import { AgentRequest } from "../../../../../types/agent/index.js";

export function buildConversation({
  prompt,
  systemPrompt,
  messages,
}: Pick<
  AgentRequest,
  "prompt" | "messages" | "systemPrompt"
>): OllamaMessage[] {
  const history = [...(messages ?? [])].filter(
    (message) => message.role !== "system",
  );

  const lastMessage = history.at(-1);

  if (
    lastMessage?.role === "user" &&
    lastMessage.content.trim() === prompt.trim()
  ) {
    history.pop();
  }

  const conversationMessages = history.map(toOllamaMessage);

  const conversation: OllamaMessage[] = [
    ...(systemPrompt
      ? [
          {
            role: "system" as const,
            content: systemPrompt,
          },
        ]
      : []),
    ...conversationMessages,
    {
      role: "user",
      content: prompt,
    },
  ];

  // console.log({
  //   function: "buildConversation",
  //   response: conversation,
  // });

  return conversation;
}
