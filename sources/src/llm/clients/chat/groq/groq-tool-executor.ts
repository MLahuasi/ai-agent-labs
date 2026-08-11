import { executeFileTool } from "../../../../tools/executor/index.js";
import {
  ToolDefinition,
  ToolExecutionError,
  ToolExecutionState,
} from "../../../../types/agent/index.js";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { validateRequiredArguments } from "../../../../utils/tools/tool.guards.js";
import { tryParseStringKeyedObject } from "../../../../utils/data/object.guards.js";
import {
  ExecutedToolResult,
  GroqToolCall,
  ModelToolCall,
} from "./groq.types.js";

/**
 * Procesa y ejecuta las herramientas solicitadas por Groq.
 */
export class GroqToolExecutor {
  /**
   * Ejecuta las herramientas solicitadas por el modelo.
   *
   * @param toolCalls Llamadas a herramientas generadas por Groq.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @return Resultados producidos por las herramientas.
   */
  async execute(
    toolCalls: GroqToolCall[],
    tools: ToolDefinition[],
    state: ToolExecutionState,
  ): Promise<ExecutedToolResult[]> {
    return Promise.all(
      toolCalls.map((toolCall) => this.processToolCall(toolCall, tools, state)),
    );
  }

  /**
   * Agrega los resultados de las herramientas al historial de Groq.
   *
   * @param conversation Conversación actual.
   * @param results Resultados de las herramientas.
   * @return No retorna ningún valor.
   */
  appendResults(
    conversation: ChatCompletionMessageParam[],
    results: ExecutedToolResult[],
  ): void {
    for (const result of results) {
      conversation.push({
        role: "tool",
        tool_call_id: result.id,
        content: result.output,
      });
    }
  }

  /**
   * Procesa una llamada antes de ejecutar la herramienta.
   *
   * @param groqToolCall Llamada generada por Groq.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @return Resultado producido por la herramienta.
   */
  private async processToolCall(
    groqToolCall: GroqToolCall,
    tools: ToolDefinition[],
    state: ToolExecutionState,
  ): Promise<ExecutedToolResult> {
    const toolName = groqToolCall.function.name;

    // Valida que Groq haya indicado el nombre de la herramienta.
    if (!toolName) {
      return {
        id: groqToolCall.id,
        output: this.buildError({
          success: false,
          error: "missing_tool_name",
          message: "Groq no indicó el nombre de la herramienta.",
        }),
      };
    }

    // Convierte los argumentos recibidos a un objeto.
    const params = tryParseStringKeyedObject(groqToolCall.function.arguments);

    if (!params) {
      return {
        id: groqToolCall.id,
        output: this.buildError({
          success: false,
          error: "invalid_arguments",
          operation: toolName,
          message:
            `Los argumentos de la herramienta ` +
            `"${toolName}" no contienen un objeto JSON válido.`,
        }),
      };
    }

    // Construye la llamada que será procesada por el ejecutor.
    const toolCall: ModelToolCall = {
      id: groqToolCall.id,
      name: toolName,
      arguments: params,
    };

    return this.executeToolCall(toolCall, tools, state);
  }

  /**
   * Ejecuta una llamada individual a una herramienta.
   *
   * @param toolCall Llamada que se desea ejecutar.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @return Resultado producido por la herramienta.
   */
  private async executeToolCall(
    toolCall: ModelToolCall,
    tools: ToolDefinition[],
    state: ToolExecutionState,
  ): Promise<ExecutedToolResult> {
    // Busca la herramienta solicitada.
    const currentTool = tools.find((tool) => tool.name === toolCall.name);

    // Valida que la herramienta esté disponible.
    if (!currentTool) {
      return {
        id: toolCall.id,
        output: this.buildError({
          success: false,
          error: "tool_not_found",
          operation: toolCall.name,
          availableTools: tools.map((tool) => tool.name),
          message: `La herramienta "${toolCall.name}" ` + "no está registrada.",
        }),
      };
    }

    // Valida los argumentos requeridos por la herramienta.
    const validation = validateRequiredArguments(
      currentTool,
      toolCall.arguments,
    );

    if (!validation.valid) {
      return {
        id: toolCall.id,
        output: this.buildError({
          success: false,
          error: "missing_required_arguments",
          operation: toolCall.name,
          missing: validation.missing,
          message: `Faltan argumentos requeridos para ` + `"${toolCall.name}".`,
        }),
      };
    }

    // Genera la firma de la llamada.
    const callSignature = JSON.stringify({
      name: toolCall.name,
      arguments: toolCall.arguments,
    });

    // Verifica si la misma llamada ya fue ejecutada.
    if (state.executedToolCalls.has(callSignature)) {
      console.warn(`Llamada duplicada detectada: ${toolCall.name}`);

      return {
        id: toolCall.id,
        output: this.buildError({
          success: false,
          error: "duplicated_tool_call",
          operation: toolCall.name,
          message:
            `La herramienta "${toolCall.name}" ya fue ` +
            "ejecutada con los mismos argumentos. " +
            "Utiliza el resultado anterior para " +
            "generar la respuesta final.",
        }),
      };
    }

    // Registra la llamada antes de ejecutarla.
    state.executedToolCalls.add(callSignature);

    console.log(
      `Ejecutando tool: ${toolCall.name} ` +
        `(${JSON.stringify(toolCall.arguments)})`,
    );

    try {
      let output = await executeFileTool(toolCall.name, toolCall.arguments);

      // Registra la herramienta ejecutada.
      state.toolsUsed.add(toolCall.name);

      // Informa al modelo cuando la herramienta no retorna contenido.
      if (!output?.trim()) {
        output = this.buildError({
          success: false,
          error: "empty_tool_result",
          operation: toolCall.name,
          message:
            `La herramienta "${toolCall.name}" ` + "no devolvió contenido.",
        });
      }

      console.log(`Herramienta completada: ${toolCall.name}`);

      return {
        id: toolCall.id,
        output,
      };
    } catch (error) {
      return {
        id: toolCall.id,
        output: this.buildError({
          success: false,
          error: "tool_execution_failed",
          operation: toolCall.name,
          message:
            error instanceof Error
              ? error.message
              : "Error desconocido ejecutando la herramienta.",
        }),
      };
    }
  }

  /**
   * Serializa un error producido durante la ejecución.
   *
   * @param error Error producido durante la ejecución.
   * @return Error serializado como JSON.
   */
  private buildError(error: ToolExecutionError): string {
    return JSON.stringify(error);
  }
}
