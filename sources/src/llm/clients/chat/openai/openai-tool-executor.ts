import OpenAI from "openai";
import { executeFileTool } from "../../../../tools/executor/index.js";
import {
  ToolDefinition,
  ToolExecutionError,
  ToolExecutionState,
} from "../../../../types/agent/index.js";
import { tryParseStringKeyedObject } from "../../../../utils/data/index.js";
import { validateRequiredArguments } from "../../../../utils/tools/tool.guards.js";
import {
  ExecutedToolResult,
  ModelToolCall,
  OpenAiToolCall,
} from "./openai.types.js";

/**
 * Procesa y ejecuta las herramientas solicitadas por OpenAI.
 */
export class OpenAiToolExecutor {
  /**
   * Ejecuta las herramientas solicitadas por el modelo.
   *
   * @param toolCalls Llamadas a herramientas generadas por OpenAI.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @return Resultados producidos por las herramientas.
   */
  async execute(
    toolCalls: OpenAiToolCall[],
    tools: ToolDefinition[],
    state: ToolExecutionState,
  ): Promise<ExecutedToolResult[]> {
    return Promise.all(
      toolCalls.map((toolCall) => this.processToolCall(toolCall, tools, state)),
    );
  }

  /**
   * Agrega los resultados de las herramientas al historial de OpenAI.
   *
   * @param input Historial actual de OpenAI.
   * @param results Resultados de las herramientas.
   * @return No retorna ningún valor.
   */
  appendResults(
    input: OpenAI.Responses.ResponseInput,
    results: ExecutedToolResult[],
  ): void {
    for (const result of results) {
      input.push({
        type: "function_call_output",
        call_id: result.callId,
        output: result.output,
      });
    }
  }

  /**
   * Procesa una llamada antes de ejecutar la herramienta.
   *
   * @param openAiToolCall Llamada generada por OpenAI.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @return Resultado producido por la herramienta.
   */
  private async processToolCall(
    openAiToolCall: OpenAiToolCall,
    tools: ToolDefinition[],
    state: ToolExecutionState,
  ): Promise<ExecutedToolResult> {
    // Convierte los argumentos recibidos a un objeto.
    const params = tryParseStringKeyedObject(openAiToolCall.arguments);

    if (!params) {
      return {
        callId: openAiToolCall.call_id,
        output: this.buildError({
          success: false,
          error: "invalid_arguments",
          operation: openAiToolCall.name,
          message:
            `Los argumentos de "${openAiToolCall.name}" ` +
            "no contienen un objeto JSON válido.",
        }),
      };
    }

    // Construye la llamada que será procesada por el ejecutor.
    const toolCall: ModelToolCall = {
      id: openAiToolCall.call_id,
      name: openAiToolCall.name,
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
        callId: toolCall.id,
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
        callId: toolCall.id,
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
        callId: toolCall.id,
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
        callId: toolCall.id,
        output,
      };
    } catch (error) {
      return {
        callId: toolCall.id,
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
