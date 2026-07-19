/**
 * Cantidad máxima de caracteres que se enviarán al modelo
 * durante la revisión de un archivo.
 *
 * Este límite ayuda a:
 * - evitar solicitudes demasiado grandes;
 * - reducir el consumo de tokens;
 * - disminuir el tiempo de respuesta;
 * - prevenir que se exceda la ventana de contexto del modelo.
 */
export const DEFAULT_MAX_CHARS = 20_000;

/**
 * Extensiones de archivos reconocidas como código fuente
 * por la herramienta de revisión.
 *
 * Una extensión fuera de esta lista puede:
 * - generar una advertencia;
 * - impedir la revisión;
 *
 * El comportamiento depende de la opción
 * `rejectUnsupportedExtensions`.
 */
export const SUPPORTED_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".cs",
  ".cpp",
  ".c",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".sql",
]);
