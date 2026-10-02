import type { Tool, ToolUnion } from "@anthropic-ai/sdk/resources/messages";
import { ToolDefinition } from "../../../../../types/agent/index.js";

/**
 * Convierte las herramientas definidas en el formato estándar
 * del proyecto al formato esperado por Anthropic.
 */
export function toAnthropicTools(
  tools?: ToolDefinition[],
): ToolUnion[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map(
    (tool): Tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.input_schema.properties,
        required: tool.input_schema.required,
        additionalProperties: false,
      },
    }),
  );
}
