/**
 * Define la estrategia utilizada para generar la revisión.
 *
 * - "complete": espera hasta recibir la respuesta completa.
 * - "stream": recibe la respuesta de forma incremental.
 */
export type FileReviewerMode = "complete" | "stream";
