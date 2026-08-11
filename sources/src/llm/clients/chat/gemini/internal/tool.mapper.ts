import { type FunctionDeclaration, type Tool } from "@google/genai";
import { ToolDefinition } from "../../../../../types/agent/index.js";

/**
 * Convierte las herramientas definidas en el formato
 * estándar del proyecto al formato esperado por Gemini.
 */
export function toGeminiTools(tools?: ToolDefinition[]): Tool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: {
      type: tool.input_schema.type,
      properties: tool.input_schema.properties,
      required: tool.input_schema.required,
      additionalProperties: false,
    },
  }));

  return [
    {
      functionDeclarations,
    },
  ];
}
