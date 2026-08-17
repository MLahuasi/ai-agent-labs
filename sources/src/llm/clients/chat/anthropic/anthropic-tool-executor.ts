import Anthropic from "@anthropic-ai/sdk";
import type {
  ToolDefinition,
  ToolExecutionError,
  ToolExecutionHandler,
  ToolExecutionState,
} from "../../../../types/agent/index.js";
import { tryGetStringKeyedObject } from "../../../../utils/data/index.js";
import { validateRequiredArguments } from "../../../../utils/tools/tool.guards.js";
import type {
  AnthropicToolCall,
  ExecutedToolResult,
  ModelToolCall,
} from "./anthropic.types.js";

/**
 * Procesa y ejecuta las herramientas solicitadas por Anthropic.
 */
export class AnthropicToolExecutor {
  /**
   * Ejecuta las herramientas solicitadas por el modelo.
   *
   * @param toolCalls Llamadas a herramientas generadas por Anthropic.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @param executeTool función que ejecuta las tools registradas
   * @return Resultados producidos por las herramientas.
   */
  async execute(
    toolCalls: AnthropicToolCall[],
    tools: ToolDefinition[],
    state: ToolExecutionState,
    executeTool: ToolExecutionHandler,
  ): Promise<ExecutedToolResult[]> {
    const availableCalls = Math.max(
      0,
      state.maxToolCalls - state.toolCallsLastTurn,
    );

    const allowedCalls = toolCalls.slice(0, availableCalls);
    const rejectedCalls = toolCalls.slice(availableCalls);

    // Cuenta las llamadas solicitadas que entran dentro del presupuesto.
    state.toolCallsLastTurn += allowedCalls.length;

    // Ejecuta en paralelo únicamente las llamadas permitidas.
    const results = await Promise.all(
      allowedCalls.map((toolCall) =>
        this.processToolCall(toolCall, tools, state, executeTool),
      ),
    );

    // Retorna un resultado de error para cada llamada que exceda el límite.
    const rejectedResults: ExecutedToolResult[] = rejectedCalls.map(
      (toolCall) => ({
        callId: toolCall.id,
        name: toolCall.name,
        output: this.buildError({
          success: false,
          error: "tool_call_limit_reached",
          operation: toolCall.name,
          message:
            `Se alcanzó el límite de ${state.maxToolCalls} ` +
            "llamadas a herramientas por turno.",
        }),
        isError: true,
      }),
    );

    return [...results, ...rejectedResults];
  }

  /**
   * Agrega los resultados de las herramientas al historial de Anthropic.
   *
   * @param messages Historial actual.
   * @param results Resultados de las herramientas.
   * @return No retorna ningún valor.
   */
  appendResults(
    messages: Anthropic.Messages.MessageParam[],
    results: ExecutedToolResult[],
  ): void {
    const content: Anthropic.Messages.ToolResultBlockParam[] = results.map(
      (result) => ({
        type: "tool_result",
        tool_use_id: result.callId,
        content: result.output,

        ...(result.isError && {
          is_error: true,
        }),
      }),
    );

    messages.push({
      role: "user",
      content,
    });
  }

  /**
   * Procesa una llamada antes de ejecutar la herramienta.
   *
   * @param anthropicToolCall Llamada generada por Anthropic.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @param executeTool función que ejecuta las tools registradas
   * @return Resultado producido por la herramienta.
   */
  private async processToolCall(
    anthropicToolCall: AnthropicToolCall,
    tools: ToolDefinition[],
    state: ToolExecutionState,
    executeTool: ToolExecutionHandler,
  ): Promise<ExecutedToolResult> {
    // Convierte los argumentos recibidos a un objeto.
    const params = tryGetStringKeyedObject(anthropicToolCall.input);

    if (!params) {
      return {
        callId: anthropicToolCall.id,
        name: anthropicToolCall.name,
        output: this.buildError({
          success: false,
          error: "invalid_arguments",
          operation: anthropicToolCall.name,
          message:
            `Los argumentos de "${anthropicToolCall.name}" ` +
            "no contienen un objeto JSON válido.",
        }),
        isError: true,
      };
    }

    // Construye la llamada que será procesada por el ejecutor.
    const toolCall: ModelToolCall = {
      id: anthropicToolCall.id,
      name: anthropicToolCall.name,
      arguments: params,
    };

    return this.executeToolCall(toolCall, tools, state, executeTool);
  }

  /**
   * Ejecuta una llamada individual a una herramienta.
   *
   * @param toolCall Llamada que se desea ejecutar.
   * @param tools Herramientas disponibles.
   * @param state Estado actual de ejecución.
   * @param executeTool función que ejecuta las tools registradas
   * @return Resultado producido por la herramienta.
   */
  private async executeToolCall(
    toolCall: ModelToolCall,
    tools: ToolDefinition[],
    state: ToolExecutionState,
    executeTool: ToolExecutionHandler,
  ): Promise<ExecutedToolResult> {
    // Busca la herramienta solicitada.
    const currentTool = tools.find((tool) => tool.name === toolCall.name);

    // Valida que la herramienta esté disponible.
    if (!currentTool) {
      return {
        callId: toolCall.id,
        name: toolCall.name,
        output: this.buildError({
          success: false,
          error: "tool_not_found",
          operation: toolCall.name,
          availableTools: tools.map((tool) => tool.name),
          message: `La herramienta "${toolCall.name}" ` + "no está registrada.",
        }),
        isError: true,
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
        name: toolCall.name,
        output: this.buildError({
          success: false,
          error: "missing_required_arguments",
          operation: toolCall.name,
          missing: validation.missing,
          message: `Faltan argumentos requeridos para ` + `"${toolCall.name}".`,
        }),
        isError: true,
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
        name: toolCall.name,
        output: this.buildError({
          success: false,
          error: "duplicated_tool_call",
          operation: toolCall.name,
          message:
            `La herramienta "${toolCall.name}" ya fue ejecutada ` +
            "con exactamente los mismos argumentos. " +
            "NO vuelvas a ejecutar esta llamada. " +
            "Utiliza el resultado anterior, elige una herramienta diferente " +
            "o genera la respuesta final.",
        }),
        isError: true,
      };
    }

    // Registra la llamada antes de ejecutarla.
    state.executedToolCalls.add(callSignature);

    console.log(
      `Ejecutando tool: ${toolCall.name} ` +
        `(${JSON.stringify(toolCall.arguments)})`,
    );

    try {
      let output = await executeTool(toolCall.name, toolCall.arguments);

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

        return {
          callId: toolCall.id,
          name: toolCall.name,
          output,
          isError: true,
        };
      }

      console.log(`Herramienta completada: ${toolCall.name}`);

      return {
        callId: toolCall.id,
        name: toolCall.name,
        output,
        isError: false,
      };
    } catch (error) {
      return {
        callId: toolCall.id,
        name: toolCall.name,
        output: this.buildError({
          success: false,
          error: "tool_execution_failed",
          operation: toolCall.name,
          message:
            error instanceof Error
              ? error.message
              : "Error desconocido ejecutando la herramienta.",
        }),
        isError: true,
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
