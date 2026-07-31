/**
 * Opciones disponibles para configurar el comportamiento
 * de la herramienta de revisión
 */
export interface FileReviewerOptions {
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
