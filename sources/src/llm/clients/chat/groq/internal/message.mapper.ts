import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "groq-sdk/resources/chat/completions";
import Groq from "groq-sdk";
import { Message, ToolCall } from "../../../../../types/agent/index.js";

export function toGroqMessage(message: Message): ChatCompletionMessageParam {
  switch (message.role) {
    case "system":
      return {
        role: "system",
        content: message.content,
      };

    case "user":
      return {
        role: "user",
        content: message.content,
      };

    case "assistant":
      return toGroqAssistantMessage(message);

    case "tool":
      return toGroqToolMessage(message);

    default:
      return assertNever(message.role);
  }
}

function toGroqAssistantMessage(message: Message): ChatCompletionMessageParam {
  const toolCalls = message.toolCalls?.map((toolCall) =>
    toGroqToolCall(toolCall),
  );

  return {
    role: "assistant",
    content: message.content,
    ...(toolCalls?.length
      ? {
          tool_calls: toolCalls,
        }
      : {}),
  };
}

function toGroqToolCall(toolCall: ToolCall): ChatCompletionMessageToolCall {
  if (!toolCall.id) throw new Error("Se debe definir id en toolcall");
  return {
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.arguments),
    },
  };
}

function toGroqToolMessage(message: Message): ChatCompletionMessageParam {
  if (!message.toolCallId) {
    throw new Error(
      'Un mensaje con role "tool" requiere la propiedad toolCallId.',
    );
  }

  return {
    role: "tool",
    content: message.content,
    tool_call_id: message.toolCallId,
    ...(message.toolName
      ? {
          name: message.toolName,
        }
      : {}),
  };
}

export function assertNever(value: never): never {
  throw new Error(`Rol de mensaje no soportado: ${String(value)}`);
}

export function responseToMessage(
  response: Groq.Chat.Completions.ChatCompletion,
): Groq.Chat.Completions.ChatCompletionAssistantMessageParam {
  const message = response.choices[0]?.message;

  if (!message) {
    throw new Error("Groq no devolvió ningún mensaje en response.choices.");
  }

  return {
    role: "assistant",
    content: message.content,
    ...(message.tool_calls?.length
      ? {
          tool_calls: message.tool_calls.map((toolCall) => ({
            id: toolCall.id,
            type: "function" as const,
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          })),
        }
      : {}),
  };
}
