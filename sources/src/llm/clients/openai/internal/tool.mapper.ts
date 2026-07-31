import OpenAI from "openai";
import { ToolDefinition } from "../../../../types/agent/index.js";

export function toOpenAITools(
  tools?: ToolDefinition[],
): OpenAI.Responses.Tool[] | undefined {
  if (!tools) return undefined;

  const openia_tools: OpenAI.Responses.Tool[] = [];
  for (const tool of tools) {
    openia_tools.push({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.input_schema.type,
        properties: tool.input_schema.properties,
        required: tool.input_schema.required,
        additionalProperties: false,
      },
      strict: false,
    });
  }

  return openia_tools;
}
