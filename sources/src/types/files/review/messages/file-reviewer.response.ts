/**
 * Resultado completo de la revisión de un archivo.
 *
 * Incluye:
 * - información del archivo;
 * - detalles sobre el contenido revisado;
 * - advertencias;
 * - respuesta generada por el modelo;
 * - métricas de consumo.
 */
export interface FileReviewerResponse {
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
