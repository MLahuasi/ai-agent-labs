/**
 * Restricción común aplicada a todos los modelos participantes.
 */
export const ANSWER_LIMIT = "Responde en máximo 200 palabras.";

/**
 * Prompt utilizado para solicitar a OpenAI la generación
 * de la pregunta común del laboratorio.
 */
export const QUESTION_GENERATOR_PROMPT = `
Propón una única pregunta basada en una situación realista
donde una persona deba tomar una decisión importante con recursos limitados.

La situación debe incluir restricciones de tiempo,
presupuesto o prioridades en conflicto.

La pregunta debe:
- ser autocontenida;
- no requerir conocimientos externos;
- poder responderse en menos de 150 palabras.

Responde únicamente con la pregunta.
`.trim();
