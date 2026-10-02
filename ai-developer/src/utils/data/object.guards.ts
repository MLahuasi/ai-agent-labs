import { NumberKeyedObject, StringKeyedObject } from "./object.types.js";

/**
 * Comprueba si un valor es un objeto no nulo y no es un array.
 *
 * @example
 * isRecord({ active: true }); // true
 * isRecord([]);               // false
 * isRecord(null);             // false
 * isRecord("texto");          // false
 */
export function isRecord(value: unknown): value is StringKeyedObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Comprueba si un valor es un objeto cuyas claves
 * representan números válidos.
 * @example
 * isNumberKeyedRecord({
 *   1: "Uno",
 *   2: "Dos",
 * });
 * result: true
 *
 * isNumberKeyedRecord({
 *   name: "Mauricio",
 * });
 * result: false
 */
export function isNumberKeyedRecord(
  value: unknown,
): value is NumberKeyedObject {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => {
      const numericKey = Number(key);

      return Number.isFinite(numericKey) && key.trim() !== "";
    })
  );
}

/**
 * Intenta convertir un string JSON en un objeto.
 *
 * Retorna undefined cuando:
 * - El string no contiene JSON válido.
 * - El resultado es null.
 * - El resultado es un array.
 * - El resultado no es un objeto.
 */
export function tryParseStringKeyedObject(
  value: string,
): StringKeyedObject | undefined {
  try {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return undefined;
    }

    return parsed as StringKeyedObject;
  } catch {
    return undefined;
  }
}

export function tryGetStringKeyedObject(
  value: unknown,
): StringKeyedObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as StringKeyedObject;
}
