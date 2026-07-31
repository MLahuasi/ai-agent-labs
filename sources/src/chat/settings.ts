/**
 * Firma esperada de cualquier funcion que
 * pueda enviar prompts a un LLM.
 */

import { AgentRequest, AgentResponse } from "../types/agent/index.js";

//export type AskFunction<TToolDefinition = never> = (
export type AskFunction = (
  //  params: AgentRequest<TToolDefinition>,
  params: AgentRequest,
) => Promise<AgentResponse>;

/**
 * Estimacion aproximada utilizada para calcular
 * el numero de tokens consumidos.
 *
 * Regla empirica:
 * 1 token ~= 4 caracteres.
 */
export const CHAR_PER_TOKEN = 4;
