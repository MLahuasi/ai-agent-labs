import { Tool as OllamaTool } from "ollama";
import { ToolDefinition } from "../../../../../types/agent/index.js";

type OllamaToolProperty = {
  type?: string | string[];
  description?: string;
  items?: unknown;
  enum?: unknown[];
};

export function toOllamaTools(
  tools?: ToolDefinition[],
): OllamaTool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map(
    (tool): OllamaTool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.input_schema.properties as Record<
            string,
            OllamaToolProperty
          >,
          required: tool.input_schema.required ?? [],
        },
      },
    }),
  );
}
