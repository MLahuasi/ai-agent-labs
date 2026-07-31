import Anthropic from "@anthropic-ai/sdk";
/**
 * Extrae todos los bloques de texto de una respuesta de Anthropic
 * y los combina en una sola cadena.
 * @param content Respuesta de Claude
 * @returns texto de la respuesta de Claude
 */
export function getAnthropicResponseText(
  // Recibe un arreglo de bloques de contenido retornados por Anthropic.
  content: Anthropic.Messages.ContentBlock[],
): string {
  // Retorna el resultado final de procesar todos los bloques.
  return (
    content
      // Filtra únicamente los bloques cuyo tipo sea "text".
      .filter(
        (block): block is Anthropic.Messages.TextBlock => block.type === "text",
      )
      // Obtiene solamente la propiedad text de cada bloque de texto.
      .map((block) => block.text)
      // Une todos los textos en una sola cadena,
      // separando cada bloque mediante un salto de línea.
      .join("\n")
  );
}

export function toAnthropicAssistantMessage(
  content: Anthropic.Messages.ContentBlock[],
): Anthropic.Messages.MessageParam {
  return {
    role: "assistant",
    content,
  };
}

/**
 * Extrae las llamadas a herramientas de una respuesta de Anthropic.
 */
export function extractAnthropicToolCalls(
  content: Anthropic.Messages.ContentBlock[],
): Anthropic.Messages.ToolUseBlock[] {
  return content.filter(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use",
  );
}
