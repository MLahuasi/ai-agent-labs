export class ActionsSettings {
  // FILE SYSTEM ACTIONS
  // Define el tamaño máximo permitido para leer un archivo.
  static readonly MAX_FILE_SIZE = 50_000;

  // Define el número máximo de coincidencias permitidas.
  static readonly MAX_SEARCH_RESULTS = 20;

  /**
   * Número máximo de archivos que puede retornar una búsqueda por nombre.
   */
  static readonly MAX_FILE_RESULTS = 50;

  // Define cuántas líneas de contexto se muestran antes y después.
  static readonly CONTEXT_LINES = 2;

  /**
   * Determina si un elemento debe ignorarse durante el recorrido.
   */
  static shouldIgnoreEntry(entryName: string): boolean {
    return (
      entryName === "node_modules" ||
      entryName === "dist" ||
      entryName === "build" ||
      entryName === "coverage" ||
      entryName.startsWith(".")
    );
  }
}
