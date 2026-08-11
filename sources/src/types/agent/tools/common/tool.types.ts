export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: Record<string, unknown>;
  };
}

export type ToolSuccess<T extends Record<string, unknown>> = {
  success: true;
} & T;

export type ToolError = {
  success: false;
  error: string;
  operation?: string;
  availableTools?: string[];
};

export type ToolResult<T extends Record<string, unknown>> =
  | ToolSuccess<T>
  | ToolError;

export interface ToolCall {
  /**
   * Identificador generado por el modelo.
   * Ejemplo: "call_abc123"
   */
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}
