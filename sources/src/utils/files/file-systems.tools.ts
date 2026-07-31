import * as path from "path";

export class FileSystemTools {
  // Obtiene la ruta absoluta desde donde se ejecutó la aplicación.
  private static readonly PROJECT_ROOT = process.cwd();
  /**
   * Normaliza una ruta relativa para mostrarla al modelo y al usuario.
   *
   * Se utiliza "/" incluso en Windows para que las rutas sean consistentes
   * entre providers y prompts.
   */
  static toRelativePath(absolutePath: string): string {
    const relativePath = path.relative(
      FileSystemTools.PROJECT_ROOT,
      absolutePath,
    );

    return `./${relativePath.split(path.sep).join("/")}`;
  }

  /**
   * Resuelve una ruta y verifica que permanezca dentro del proyecto.
   * Retorna la ruta absoluta válida o null si intenta salir del proyecto.
   */
  static resolveSecurePath(targetPath: string): string | null {
    // Convierte la ruta recibida en una ruta absoluta basada en el proyecto.
    const absolutePath = path.resolve(FileSystemTools.PROJECT_ROOT, targetPath);

    // Agrega el separador del sistema para validar directorios descendientes.
    const projectWithSeparator = FileSystemTools.PROJECT_ROOT + path.sep;

    // Verifica que la ruta sea la raíz o esté contenida dentro del proyecto.
    if (
      !absolutePath.startsWith(projectWithSeparator) &&
      absolutePath !== FileSystemTools.PROJECT_ROOT
    ) {
      // Rechaza rutas que intentan salir del directorio del proyecto.
      return null;
    }

    // Retorna la ruta absoluta porque pasó la validación.
    return absolutePath;
  }

  /**
   * Obtiene el PROJECT_ROOT
   * @returns PROJECT_ROOT
   */
  static getProjectRoot(): string {
    return FileSystemTools.PROJECT_ROOT;
  }

  /**
   * Construye la ruta completa de un elemento dentro de un directorio.
   *
   * @param dirPath Ruta del directorio padre.
   * @param entryName Nombre del archivo o subdirectorio.
   * @returns Ruta resultante combinando ambos valores.
   */
  static buildFullPath(dirPath: string, entryName: string): string {
    return path.join(dirPath, entryName);
  }

  /**
   * Obtiene el nombre de un archivo a partir de su ruta
   * y lo normaliza a minúsculas.
   *
   * @param file Ruta absoluta o relativa del archivo.
   * @returns Nombre del archivo en minúsculas, incluyendo su extensión.
   *
   * @example
   * getNormalizedFileName("./src/utils/config.ts");
   * "config.ts"
   */
  static getNormalizedFileName(file: string): string {
    return path.basename(file).toLowerCase();
  }
}
