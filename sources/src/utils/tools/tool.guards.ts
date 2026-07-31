import { ToolDefinition } from "../../types/agent/index.js";
import { StringKeyedObject } from "../data/object.types.js";

/**
 * Busca una herramienta por su nombre.
 *
 * @example
 * const tool = findToolDefinition("sendEmail", tools);
 *
 * if (tool) {
 *   console.log(tool.name);
 * }
 */
export function findToolDefinition(
  toolName: string,
  tools?: ToolDefinition[],
): ToolDefinition | undefined {
  // Busca la primera herramienta cuyo nombre coincida.
  return tools?.find((tool) => tool.name === toolName);
}

/**
 * Valida que los argumentos obligatorios de una herramienta estén presentes.
 *
 * Considera inválidos:
 * - `undefined`
 * - `null`
 * - Strings vacíos o con solo espacios
 *
 * @example
 * const error = validateRequiredArguments(tool, {
 *   recipient: "user@example.com",
 *   subject: "",
 * });
 *
 * console.log(error);
 * result: Faltan parámetros obligatorios: subject."
 */
export function validateRequiredArguments(
  tool: ToolDefinition,
  params: StringKeyedObject,
): RequiredArgumentsValidation {
  // Obtiene la lista de propiedades obligatorias.
  const required = tool.input_schema.required ?? [];

  // Busca cuáles propiedades obligatorias no tienen un valor válido.
  const missing = required.filter((propertyName) => {
    if (!(propertyName in params)) {
      return true;
    }

    const value = params[propertyName];

    return (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    );
  });

  // Devuelve un mensaje de error o null si todo es válido.
  return {
    valid: missing.length === 0,
    missing,
  };
}

export interface RequiredArgumentsValidation {
  valid: boolean;
  missing: string[];
}
