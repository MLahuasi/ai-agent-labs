import { AgentRequest, Message } from "../../types/agent/index.js";

/**
 * Define la estrategia utilizada para generar la revisión.
 */
export type FileReviewerMode = "complete" | "stream";

/**
 * Configuración general del revisor de archivos.
 */
export interface FileReviewerOptions {
  maxChars?: number;
  rejectUnsupportedExtensions?: boolean;
}

/**
 * Datos necesarios para revisar un archivo.
 */
export interface FileReviewRequest {
  filePath: string;
  prompt: string;
  systemPrompt?: string;
  mode?: FileReviewerMode;
  messages?: Message[];
  /**
   * Callback invocado por cada fragmento recibido durante streaming.
   */
  onChunk?: AgentRequest["onChunk"];
}

/**
 * Resultado generado durante la revisión de un archivo.
 */
export interface FileReviewerResponse {
  fileName: string;
  filePath: string;
  extension: string;
  totalLines: number;
  totalCharacters: number;
  truncated: boolean;
  reviewedCharacters: number;
  warnings: string[];
  review: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  question: string;
}

export interface CodeReviewUseCaseResult {
  success: boolean;
  data?: FileReviewerResponse;
  message?: string;
}
