import { AgentRequest, AgentResponse } from "../types/agent/index.js";

/**
 * Define la firma utilizada para enviar solicitudes a un modelo LLM.
 *
 * @param params Datos necesarios para ejecutar la solicitud.
 * @return Respuesta generada por el agente.
 */
export type AskFunction = (params: AgentRequest) => Promise<AgentResponse>;

/**
 * Define la cantidad aproximada de caracteres por token.
 *
 * Se utiliza para estimar el consumo de tokens cuando
 * no se dispone de un conteo exacto.
 * 1 token ~= 4 caracteres.
 */
export const CHAR_PER_TOKEN = 4;
