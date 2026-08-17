import * as path from "path";
import * as fsAsync from "fs/promises";
import * as fs from "fs";
import { Dirent } from "fs";
import { ActionsSettings } from "../../tools/actions/index.js";

export class FileSystemTools {
  /**
   * Define la ruta raíz del proyecto.
   */
  static readonly PROJECT_ROOT = path.resolve(process.cwd());

  // ---------------------------------------------------------------------------
  // PATHS
  // ---------------------------------------------------------------------------

  /**
   * Obtiene la ruta raíz del proyecto.
   *
   * @return Ruta raíz del proyecto.
   */
  static getProjectRoot(): string {
    return FileSystemTools.PROJECT_ROOT;
  }

  /**
   * Obtiene una ruta relativa a la raíz del proyecto.
   *
   * @param absolutePath Ruta absoluta que se desea convertir.
   * @return Ruta relativa a PROJECT_ROOT.
   */
  static getRelativePath(absolutePath: string): string {
    return path.relative(FileSystemTools.PROJECT_ROOT, absolutePath);
  }

  /**
   * Normaliza una ruta relativa para mostrarla de forma consistente.
   *
   * @param filePath Ruta que se desea normalizar.
   * @return Ruta relativa normalizada.
   */
  static toRelativePath(filePath: string): string {
    // Resuelve la ruta absoluta.
    const absolutePath = path.resolve(filePath);

    // Obtiene la ruta relativa al proyecto.
    const relativePath = this.getRelativePath(absolutePath);

    // Normaliza los separadores de la ruta.
    return `./${relativePath.split(path.sep).join("/")}`;
  }

  /**
   * Resuelve una ruta y verifica que permanezca dentro del proyecto.
   *
   * @param targetPath Ruta que se desea validar.
   * @return Ruta absoluta validada o null si está fuera del proyecto.
   */
  static resolveSecurePath(targetPath: string): string | null {
    // Rechaza rutas vacías.
    if (!targetPath.trim()) {
      return null;
    }

    // Resuelve la ruta desde la raíz del proyecto.
    const absolutePath = path.resolve(FileSystemTools.PROJECT_ROOT, targetPath);

    // Obtiene la ruta relativa al proyecto.
    const relativePath = this.getRelativePath(absolutePath);

    // Comprueba si la ruta está fuera del proyecto.
    const isOutsideProject =
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath);

    // Rechaza rutas externas.
    return isOutsideProject ? null : absolutePath;
  }

  /**
   * Construye la ruta de un elemento dentro de un directorio.
   *
   * @param directoryPath Ruta del directorio.
   * @param entryName Nombre del archivo o subdirectorio.
   * @return Ruta completa del elemento.
   */
  static buildFullPath(directoryPath: string, entryName: string): string {
    return path.join(directoryPath, entryName);
  }

  /**
   * Construye la ruta de un archivo desde una ruta de referencia.
   *
   * @param referencePath Ruta utilizada como referencia.
   * @param fileName Nombre del archivo.
   * @return Ruta completa del archivo.
   */
  static buildFilePath(referencePath: string, fileName: string): string {
    // Valida la ruta de referencia.
    if (!referencePath.trim()) {
      throw new Error("referencePath no puede estar vacío.");
    }

    // Valida el nombre del archivo.
    if (!fileName.trim()) {
      throw new Error("fileName no puede estar vacío.");
    }

    // Evita que fileName incluya una ruta.
    if (fileName.includes("/") || fileName.includes("\\")) {
      throw new Error(
        "fileName debe contener únicamente el nombre del archivo.",
      );
    }

    // Construye la ruta del archivo.
    return this.buildFullPath(path.dirname(referencePath), fileName);
  }

  /**
   * Obtiene el nombre de un archivo en minúsculas.
   *
   * @param filePath Ruta del archivo.
   * @return Nombre del archivo en minúsculas.
   */
  static getLowerCaseFileName(filePath: string): string {
    return path.basename(filePath).toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // FILE SYSTEM INFO
  // ---------------------------------------------------------------------------

  /**
   * Obtiene la información del sistema de archivos de una ruta.
   *
   * @param targetPath Ruta que se desea consultar.
   * @return Información asociada a la ruta.
   */
  static async getStat(
    targetPath: string,
  ): Promise<Awaited<ReturnType<typeof fsAsync.stat>>> {
    try {
      // Obtiene la información de la ruta.
      return await fsAsync.stat(targetPath);
    } catch (error) {
      // Propaga el error con información de contexto.
      throw new Error(`No se pudo consultar la ruta: ${targetPath}`, {
        cause: error,
      });
    }
  }

  /**
   * Lee los elementos contenidos en un directorio.
   *
   * @param directoryPath Ruta del directorio.
   * @return Archivos y subdirectorios encontrados.
   */
  static async readDiretory(directoryPath: string): Promise<Dirent[]> {
    try {
      // Lee las entradas del directorio.
      return await fsAsync.readdir(directoryPath, {
        withFileTypes: true,
      });
    } catch (error) {
      // Propaga el error con información de contexto.
      throw new Error(`No se pudo leer el directorio: ${directoryPath}`, {
        cause: error,
      });
    }
  }

  /**
   * Obtiene recursivamente los archivos de un directorio.
   *
   * @param dirPath Ruta del directorio que se desea recorrer.
   * @param extension Extensión opcional utilizada para filtrar archivos.
   * @return Lista de archivos encontrados.
   */
  static async collectFiles(
    dirPath: string,
    extension?: string,
  ): Promise<string[]> {
    // Almacena los archivos encontrados.
    const results: string[] = [];

    // Almacena las entradas del directorio.
    let entries;

    try {
      // Lee los elementos del directorio.
      entries = await FileSystemTools.readDiretory(dirPath);
    } catch {
      // Retorna una lista vacía si el directorio no puede leerse.
      return results;
    }

    // Recorre los elementos encontrados.
    for (const entry of entries) {
      // Ignora elementos configurados para no ser procesados.
      if (ActionsSettings.shouldIgnoreEntry(entry.name)) {
        continue;
      }

      // Construye la ruta completa del elemento.
      const fullPath = FileSystemTools.buildFullPath(dirPath, entry.name);

      // Procesa recursivamente los subdirectorios.
      if (entry.isDirectory()) {
        const subFiles = await this.collectFiles(fullPath, extension);

        // Agrega los archivos encontrados.
        results.push(...subFiles);

        continue;
      }

      // Agrega archivos que coinciden con el filtro.
      if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
        results.push(fullPath);
      }
    }

    // Retorna los archivos encontrados.
    return results;
  }

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  /**
   * Lee un archivo de texto utilizando la codificación indicada.
   *
   * @param filePath Ruta del archivo.
   * @param encoding Codificación utilizada para leer el contenido.
   * @return Contenido del archivo.
   */
  static async readFile(
    filePath: string,
    encoding: BufferEncoding = "utf-8",
  ): Promise<string> {
    try {
      // Lee el contenido del archivo.
      return await fsAsync.readFile(filePath, encoding);
    } catch (error) {
      // Convierte el error al tipo utilizado por Node.js.
      const err = error as NodeJS.ErrnoException;

      // Retorna un mensaje si el archivo no existe.
      if (err.code === "ENOENT") {
        return `Error: el archivo ${filePath} no existe.`;
      }

      // Propaga otros errores de lectura.
      throw new Error(`No se pudo leer el archivo: ${filePath}`, {
        cause: error,
      });
    }
  }

  /**
   * Lee un archivo como contenido binario.
   *
   * @param filePath Ruta del archivo.
   * @return Contenido binario del archivo.
   */
  static async readBuffer(filePath: string): Promise<Buffer> {
    try {
      // Lee el contenido binario.
      return await fsAsync.readFile(filePath);
    } catch (error) {
      // Propaga el error de lectura.
      throw new Error(`No se pudo leer el archivo: ${filePath}`, {
        cause: error,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // CREATE AND WRITE
  // ---------------------------------------------------------------------------

  /**
   * Crea un directorio.
   *
   * @param directoryPath Ruta del directorio que se desea crear.
   * @return No retorna ningún valor.
   */
  static createDirectory(directoryPath: string): void {
    // Crea el directorio y sus directorios padres si no existen.
    fs.mkdirSync(directoryPath, {
      recursive: true,
    });
  }

  /**
   * Crea un directorio de forma asíncrona.
   *
   * @param directoryPath Ruta del directorio que se desea crear.
   * @return No retorna ningún valor.
   */
  static async createDirectoryAsync(directoryPath: string): Promise<void> {
    // Crea el directorio y sus directorios padres si no existen.
    await fsAsync.mkdir(directoryPath, {
      recursive: true,
    });
  }

  /**
   * Garantiza que exista una ruta de archivo o directorio.
   *
   * @param targetPath Ruta que se desea crear.
   * @return No retorna ningún valor.
   */
  static ensurePath(targetPath: string): void {
    // Rechaza rutas vacías.
    if (!targetPath.trim()) {
      throw new Error("targetPath no puede estar vacío.");
    }

    // Obtiene el último segmento de la ruta.
    const fileName = path.basename(targetPath);

    // Determina si la ruta contiene un archivo.
    const containsFile = path.extname(fileName).length > 0;

    // Crea la ruta completa como directorio.
    if (!containsFile) {
      this.createDirectory(targetPath);

      return;
    }

    // Obtiene el directorio padre.
    const directoryPath = path.dirname(targetPath);

    // Construye la ruta del archivo.
    const filePath = this.buildFullPath(directoryPath, fileName);

    // Garantiza que exista el directorio padre.
    this.createDirectory(directoryPath);

    // Crea el archivo si no existe.
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "");
    }
  }

  /**
   * Garantiza de forma asíncrona que exista una ruta.
   *
   * @param targetPath Ruta que se desea crear.
   * @return No retorna ningún valor.
   */
  static async ensurePathAsync(targetPath: string): Promise<void> {
    // Rechaza rutas vacías.
    if (!targetPath.trim()) {
      throw new Error("targetPath no puede estar vacío.");
    }

    // Obtiene el último segmento de la ruta.
    const fileName = path.basename(targetPath);

    // Determina si la ruta contiene un archivo.
    const containsFile = path.extname(fileName).length > 0;

    // Crea la ruta completa como directorio.
    if (!containsFile) {
      await fsAsync.mkdir(targetPath, {
        recursive: true,
      });

      return;
    }

    // Obtiene el directorio padre.
    const directoryPath = path.dirname(targetPath);

    // Construye la ruta del archivo.
    const filePath = this.buildFullPath(directoryPath, fileName);

    // Garantiza que exista el directorio padre.
    await fsAsync.mkdir(directoryPath, {
      recursive: true,
    });

    // Crea el archivo si no existe.
    const fileHandle = await fsAsync.open(filePath, "a");

    // Cierra el archivo.
    await fileHandle.close();
  }

  /**
   * Guarda contenido en un archivo.
   *
   * @param filePath Ruta donde se guardará el contenido.
   * @param content Contenido que se desea guardar.
   * @param encoding Codificación utilizada para guardar texto.
   * @return No retorna ningún valor.
   */
  static async writeFile(
    filePath: string,
    content: string | Buffer,
    encoding: BufferEncoding = "utf-8",
  ): Promise<void> {
    // Garantiza que exista la ruta.
    await FileSystemTools.ensurePathAsync(filePath);

    // Guarda contenido de texto.
    if (typeof content === "string") {
      await fsAsync.writeFile(filePath, content, encoding);

      return;
    }

    // Guarda contenido binario.
    await fsAsync.writeFile(filePath, content);
  }
}
