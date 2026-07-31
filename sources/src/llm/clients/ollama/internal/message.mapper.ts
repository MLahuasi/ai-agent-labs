import { Message as OllamaMessage, ToolCall as OllamaToolCall } from "ollama";
import { Message, Role, ToolCall } from "../../../../types/agent/index.js";

function isRole(role: string): role is Role {
  return (
    role === "system" ||
    role === "user" ||
    role === "assistant" ||
    role === "tool"
  );
}

function toAgentToolCall(toolCall: OllamaToolCall): ToolCall {
  return {
    name: toolCall.function.name,
    arguments: toolCall.function.arguments,
  };
}

function toOllamaToolCall(toolCall: ToolCall): OllamaToolCall {
  return {
    function: {
      name: toolCall.name,
      arguments: toolCall.arguments,
    },
  };
}

export function toAgentMessages(messages: OllamaMessage[]): Message[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message): Message => {
      if (!isRole(message.role)) {
        throw new Error(`Rol de Ollama no soportado: "${message.role}".`);
      }

      return {
        role: message.role,
        content: message.content ?? "",
        toolName: message.role === "tool" ? message.tool_name : undefined,
        toolCalls:
          message.role === "assistant" && message.tool_calls?.length
            ? message.tool_calls.map(toAgentToolCall)
            : undefined,
      };
    });
}

export function toOllamaMessage(message: Message): OllamaMessage {
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
      tool_name: message.toolName,
    };
  }

  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content,
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map(toOllamaToolCall),
          }
        : {}),
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}
