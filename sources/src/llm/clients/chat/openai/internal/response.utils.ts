import OpenAI from "openai";

/**
 * Normaliza la salida de OpenAI antes de reutilizarla como input.
 *
 * Elimina propiedades auxiliares agregadas por el SDK durante el procesamiento
 * de respuestas que no forman parte del contrato válido de Responses API.
 *
 * @param output Elementos generados por OpenAI.
 * @return Elementos compatibles con ResponseInput.
 */
export function normalizeResponseOutput(
  output: OpenAI.Responses.Response["output"],
): OpenAI.Responses.ResponseOutputItem[] {
  return output.map((item) => {
    if (item.type !== "function_call") {
      return item;
    }

    const { parsed_arguments: _parsedArguments, ...functionCall } =
      item as typeof item & {
        parsed_arguments?: unknown;
      };

    return functionCall;
  });
}
