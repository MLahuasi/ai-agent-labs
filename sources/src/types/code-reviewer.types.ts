/**
 * Define la estrategia utilizada para generar la revisión.
 *
 * - "complete": espera hasta recibir la respuesta completa.
 * - "stream": recibe la respuesta de forma incremental.
 */
export type ReviewMode = "complete" | "stream";

/**
 * Opciones disponibles para configurar el comportamiento
 * de la herramienta de revisión de código.
 */
export interface CodeReviewerOptions {
  /**
   * Cantidad máxima de caracteres que pueden enviarse
   * al modelo durante una revisión.
   *
   * Si el archivo supera este límite, su contenido
   * puede ser truncado antes de construir la solicitud.
   *
   * Si no se especifica, se utiliza `DEFAULT_MAX_CHARS`.
   */
  maxChars?: number;

  /**
   * Determina cómo se deben tratar las extensiones
   * que no están registradas en `SUPPORTED_FILE_EXTENSIONS`.
   *
   * - false: permite continuar y genera una advertencia.
   * - true: detiene el proceso y genera un error.
   */
  rejectUnsupportedExtensions?: boolean;
}

/**
 * Resultado completo de la revisión de un archivo de código.
 *
 * Incluye:
 * - información del archivo;
 * - detalles sobre el contenido revisado;
 * - advertencias;
 * - respuesta generada por el modelo;
 * - métricas de consumo.
 */
export interface CodeReviewResult {
  /**
   * Nombre del archivo revisado, sin incluir su ruta.
   *
   * Ejemplo:
   * "user.service.ts"
   */
  fileName: string;

  /**
   * Ruta absoluta del archivo revisado.
   *
   * Permite identificar exactamente qué archivo
   * fue utilizado durante el análisis.
   */
  filePath: string;

  /**
   * Extensión detectada en el archivo.
   *
   * Ejemplo:
   * ".ts"
   */
  extension: string;

  /**
   * Número total de líneas del archivo original.
   *
   * Este valor corresponde al archivo completo,
   * incluso cuando su contenido fue truncado.
   */
  totalLines: number;

  /**
   * Número total de caracteres del archivo original.
   *
   * Este valor permite conocer el tamaño real
   * del archivo antes de aplicar límites.
   */
  totalCharacters: number;

  /**
   * Indica si el contenido enviado al modelo
   * fue reducido por superar el límite configurado.
   *
   * - true: se revisó solo una parte del archivo.
   * - false: se revisó el contenido completo.
   */
  truncated: boolean;

  /**
   * Cantidad de caracteres que realmente fueron
   * incluidos en la solicitud enviada al modelo.
   */
  reviewedCharacters: number;

  /**
   * Advertencias generadas durante la preparación
   * o validación del archivo.
   *
   * Ejemplos:
   * - extensión no reconocida;
   * - contenido truncado por tamaño.
   */
  warnings: string[];

  /**
   * Texto de la revisión generado por el modelo.
   */
  review: string;

  /**
   * Cantidad de tokens de entrada reportados
   * por el proveedor del modelo.
   */
  totalInputTokens: number;

  /**
   * Cantidad de tokens de salida generados
   * durante la revisión.
   */
  totalOutputTokens: number;
}
