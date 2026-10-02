import { Message } from "../chat/index.js";
import {
  ToolDefinition,
  ToolExecutionHandler,
  ToolExecutionState,
} from "../tools/index.js";

/**
 * Define los datos necesarios para ejecutar una solicitud del agente.
 */
export interface AgentRequest {
  /**
   * Mensaje principal enviado al modelo.
   */
  prompt: string;

  /**
   * Prompt de sistema utilizado para configurar el comportamiento del modelo.
   */
  systemPrompt?: string;

  /**
   * Historial opcional de mensajes de la conversación.
   */
  messages?: Message[];

  /**
   * Herramientas disponibles para el modelo.
   */
  tools?: ToolDefinition[];

  /**
   * Función opcional utilizada para ejecutar herramientas.
   */
  executeTool?: ToolExecutionHandler;

  /**
   * Estado de ejecución de herramientas para el turno actual.
   */
  toolState?: ToolExecutionState;

  /**
   * Máximo de tokens para respuestas sin herramientas.
   */
  maxTokens: number;

  /**
   * Máximo de tokens para respuestas que utilizan herramientas.
   */
  maxTokensTools: number;

  /**
   * Máximo de iteraciones permitidas durante una ejecución con herramientas.
   */
  maxIterations: number;

  onChunk?: (chunk: string) => void;
}
