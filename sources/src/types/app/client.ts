import { AgentRequest, AgentResponse } from "../agent/index.js";

/**
 * Contrato que debe implementar cualquier cliente LLM.
 *
 * Permite intercambiar proveedores sin modificar
 * el resto de la aplicacion.
 */
export interface LlmClient {
  /**
   * Genera una respuesta completa y la retorna una vez finalizada.
   */
  ask(params: AgentRequest): Promise<AgentResponse>;

  /**
   * Genera una respuesta completa usando tools y la retorna una vez finalizada.
   */
  askWithTools(params: AgentRequest): Promise<AgentResponse>;

  /**
   * Genera una respuesta en modo streaming.
   */
  stream(params: AgentRequest): Promise<AgentResponse>;
}
