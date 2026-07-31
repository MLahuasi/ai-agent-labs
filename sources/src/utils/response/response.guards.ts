import { ToolResult } from "../../types/agent/index.js";

export function normalizeLiteralText(value: string): string {
  let normalized = value.trim();

  const wrappers: RegExp[] = [
    /^\\s[*+?]/,
    /\\s[*+?]$/,
    /^\.\*/,
    /\.\*$/,
    /^\^/,
    /\$$/,
  ];

  let changed = true;

  while (changed) {
    changed = false;

    for (const wrapper of wrappers) {
      const result = normalized.replace(wrapper, "").trim();

      if (result !== normalized) {
        normalized = result;
        changed = true;
      }
    }
  }

  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")) ||
      (normalized.startsWith("`") && normalized.endsWith("`")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

/**
 * Intenta convertir un string JSON en un valor de JavaScript.
 *
 * Devuelve `null` cuando el texto no contiene un JSON válido.
 *
 * @example
 * const result = parseJson('{"name":"Mauricio","age":30}');
 *
 * console.log(result);
 * return { name: "Mauricio", age: 30 }
 */
export function parseJson(value: string | any): unknown {
  try {
    // Convierte el texto JSON en un valor de JavaScript.
    return JSON.parse(value);
  } catch {
    // Devuelve null cuando el texto no es un JSON válido.
    return null;
  }
}

/**
 * Serializa una respuesta para retornarla como salida de una tool.
 */
export function serialize<T extends Record<string, unknown>>(
  result: ToolResult<T>,
): string {
  return JSON.stringify(result);
}
