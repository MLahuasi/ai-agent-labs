import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { ToolDefinition } from "../../../../../types/agent/index.js";

export function toGroqTools(
  tools?: readonly ToolDefinition[],
): ChatCompletionTool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map(
    (tool): ChatCompletionTool => ({
      type: "function",

      function: {
        name: tool.name,
        description: tool.description,

        parameters: {
          type: "object",
          properties: tool.input_schema.properties,
          required: tool.input_schema.required ?? [],
          additionalProperties: false,
        },
      },
    }),
  );
}
