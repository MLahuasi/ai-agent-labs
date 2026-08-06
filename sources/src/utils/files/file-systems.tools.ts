import * as path from "path";
import * as fsAsync from "fs/promises";
import * as fs from "fs";
import { Dirent } from "fs";

export class FileSystemTools {
  /**
   * Directorio desde el cual se inició el proceso.
   */
  private static readonly PROJECT_ROOT = path.resolve(process.cwd());

  /**
   * Normaliza una ruta relativa para mostrarla al modelo y al usuario.
   *
   * Se utiliza "/" incluso en Windows para que las rutas sean consistentes
   * entre providers y prompts.
   */
  static toRelativePath(filePath: string): string {
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(
      FileSystemTools.PROJECT_ROOT,
      absolutePath,
    );

    return `./${relativePath.split(path.sep).join("/")}`;
  }

  /**
   * Resuelve una ruta respecto a la raíz del proyecto y verifica
   * que el resultado permanezca dentro de ella.
   *
   * @param targetPath Ruta relativa o absoluta que se desea validar.
   * @returns Ruta absoluta segura o `null` si apunta fuera del proyecto.
   */
  static resolveSecurePath(targetPath: string): string | null {
    if (!targetPath.trim()) {
      return null;
    }

    // Resuelve la ruta tomando PROJECT_ROOT como directorio base.
    const absolutePath = path.resolve(FileSystemTools.PROJECT_ROOT, targetPath);

    // Calcula cómo llegar desde PROJECT_ROOT hasta la ruta resuelta.
    const relativePath = path.relative(
      FileSystemTools.PROJECT_ROOT,
      absolutePath,
    );

    // La ruta está fuera del proyecto cuando:
    //
    // - Es exactamente "..".
    // - Comienza con "../" o "..\".
    // - `path.relative` devuelve una ruta absoluta, por ejemplo,
    //   cuando las rutas están en unidades distintas en Windows.
    const isOutsideProject =
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath);

    // Rechaza cualquier ruta externa.
    return isOutsideProject ? null : absolutePath;
  }

  /**
   * Obtiene la raíz utilizada por las herramientas de archivos.
   * @returns PROJECT_ROOT
   */
  static getProjectRoot(): string {
    return FileSystemTools.PROJECT_ROOT;
  }

  /**
   * Construye la ruta completa de un elemento dentro de un directorio.
   * Une un directorio con el nombre de una entrada.
   *
   * @param directoryPath Ruta del directorio padre.
   * @param entryName Nombre del archivo o subdirectorio.
   * @returns Ruta resultante combinando ambos valores.
   */
  static buildFullPath(directoryPath: string, entryName: string): string {
    return path.join(directoryPath, entryName);
  }

  /**
   * Obtiene el nombre de un archivo en minúsculas.
   *
   * @param filePath Ruta absoluta o relativa del archivo.
   * @returns Nombre del archivo en minúsculas, incluyendo su extensión.
   */
  static getLowerCaseFileName(filePath: string): string {
    return path.basename(filePath).toLowerCase();
  }

  /**
   * Lee los archivos y subdirectorios contenidos en un directorio.
   *
   * @param directoryPath Ruta del directorio padre
   */
  static async readDiretory(directoryPath: string): Promise<Dirent[]> {
    try {
      return await fsAsync.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      throw new Error(`No se pudo leer el directorio: ${directoryPath}`, {
        cause: error,
      });
    }
  }

  /**
   * Garantiza que exista una ruta de archivo o directorio.
   *
   * Si `targetPath` parece contener un archivo:
   * - reserva el nombre del archivo;
   * - crea únicamente el directorio padre;
   * - crea el archivo vacío si no existe.
   *
   * Si no parece contener un archivo:
   * - crea el directorio completo.
   *
   * @param targetPath Ruta de archivo o directorio.
   */
  static ensurePath(targetPath: string): void {
    if (!targetPath.trim()) {
      throw new Error("targetPath no puede estar vacío.");
    }

    // Obtiene el nombre final de la ruta.
    // Ejemplo: "./data/vector.db" -> "vector.db"
    const fileName = path.basename(targetPath);

    // Determina si el último segmento parece ser un archivo.
    const containsFile = path.extname(fileName).length > 0;

    if (!containsFile) {
      // La ruta completa se considera un directorio.
      fs.mkdirSync(targetPath, {
        recursive: true,
      });

      return;
    }

    // Reserva el directorio padre y el nombre del archivo.
    const directoryPath = path.dirname(targetPath);
    const filePath = path.join(directoryPath, fileName);

    // Garantiza que exista el directorio padre.
    fs.mkdirSync(directoryPath, {
      recursive: true,
    });

    // Crea el archivo vacío únicamente si no existe.
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "");
    }
  }

  /**
   * Garantiza de forma asíncrona que exista una ruta
   * de archivo o directorio.
   *
   * Si `targetPath` parece contener un archivo:
   * - crea el directorio padre;
   * - crea el archivo vacío si no existe.
   *
   * Si no parece contener un archivo:
   * - crea el directorio completo.
   *
   * @param targetPath Ruta de archivo o directorio.
   */
  static async ensurePathAsync(targetPath: string): Promise<void> {
    if (!targetPath.trim()) {
      throw new Error("targetPath no puede estar vacío.");
    }

    // Obtiene el nombre final de la ruta.
    const fileName = path.basename(targetPath);

    // Determina si parece tratarse de un archivo.
    const containsFile = path.extname(fileName).length > 0;

    if (!containsFile) {
      // La ruta completa se considera un directorio.
      await fsAsync.mkdir(targetPath, {
        recursive: true,
      });

      return;
    }

    // Obtiene el directorio padre y reconstruye la ruta del archivo.
    const directoryPath = path.dirname(targetPath);
    const filePath = path.join(directoryPath, fileName);

    // Garantiza que exista el directorio padre.
    await fsAsync.mkdir(directoryPath, {
      recursive: true,
    });

    // El flag "a" crea el archivo si no existe
    // y conserva su contenido si ya existe.
    const fileHandle = await fsAsync.open(filePath, "a");

    await fileHandle.close();
  }

  /**
   * Lee de forma async un archivo de texto con la codificación indicada.
   * Por defecto, devuelve el contenido como texto codificado en UTF-8.
   *
   * @param filePath Ruta del archivo que se desea leer.
   * @param encoding Codificación utilizada para interpretar el contenido.
   * @returns Contenido del archivo como una cadena de texto.
   */
  static async readFile(
    filePath: string,
    encoding: BufferEncoding = "utf-8",
  ): Promise<string> {
    try {
      // Lee el archivo usando la codificación indicada.
      return await fsAsync.readFile(filePath, encoding);
    } catch (error) {
      throw new Error(`No se pudo leer el archivo: ${filePath}`, {
        cause: error,
      });
    }
  }

  /**
   * Lee un archivo como contenido binario.
   * @param filePath Ruta del archivo que se desea leer.
   * @returns Contenido del archivo como Buffer.
   */
  static async readBuffer(filePath: string): Promise<Buffer> {
    try {
      return await fsAsync.readFile(filePath);
    } catch (error) {
      throw new Error(`No se pudo leer el archivo: ${filePath}`, {
        cause: error,
      });
    }
  }

  /**
   * Construye la ruta completa de un archivo usando
   * el directorio de una ruta de referencia.
   *
   * @param referencePath Ruta usada para obtener el directorio.
   * @param fileName Nombre del archivo.
   * @returns Ruta completa del archivo.
   */
  static buildFilePath(referencePath: string, fileName: string): string {
    if (!referencePath.trim()) {
      throw new Error("referencePath no puede estar vacío.");
    }

    if (!fileName.trim()) {
      throw new Error("fileName no puede estar vacío.");
    }

    if (fileName.includes("/") || fileName.includes("\\")) {
      throw new Error(
        "fileName debe contener únicamente el nombre del archivo.",
      );
    }

    return path.join(path.dirname(referencePath), fileName);
  }

  /**
   * Guarda contenido en un archivo.
   *
   * Si el directorio padre no existe, lo crea automáticamente.
   *
   * @param filePath Ruta donde se escribirá el archivo.
   * @param content Contenido que se guardará.
   */
  static async writeFile(
    filePath: string,
    content: string | Buffer,
    encoding: BufferEncoding = "utf-8",
  ): Promise<void> {
    await FileSystemTools.ensurePathAsync(filePath);

    if (typeof content === "string") {
      await fsAsync.writeFile(filePath, content, encoding);

      return;
    }

    await fsAsync.writeFile(filePath, content);
  }
}

// import * as path from "path";
// import * as fsAsync from "fs/promises";
// import * as fs from "fs";
// import { Dirent } from "fs";
// // import { Dirent } from "fs";

// export class FileSystemTools {
//   // Obtiene la ruta absoluta desde donde se ejecutó la aplicación.
//   private static readonly PROJECT_ROOT = process.cwd();
//   /**
//    * Normaliza una ruta relativa para mostrarla al modelo y al usuario.
//    *
//    * Se utiliza "/" incluso en Windows para que las rutas sean consistentes
//    * entre providers y prompts.
//    */
//   static toRelativePath(absolutePath: string): string {
//     const relativePath = path.relative(
//       FileSystemTools.PROJECT_ROOT,
//       absolutePath,
//     );

//     return `./${relativePath.split(path.sep).join("/")}`;
//   }

//   /**
//    * Resuelve una ruta y verifica que permanezca dentro del proyecto.
//    * Retorna la ruta absoluta válida o null si intenta salir del proyecto.
//    */
//   static resolveSecurePath(targetPath: string): string | null {
//     // Convierte la ruta recibida en una ruta absoluta basada en el proyecto.
//     const absolutePath = path.resolve(FileSystemTools.PROJECT_ROOT, targetPath);

//     // Agrega el separador del sistema para validar directorios descendientes.
//     const projectWithSeparator = FileSystemTools.PROJECT_ROOT + path.sep;

//     // Verifica que la ruta sea la raíz o esté contenida dentro del proyecto.
//     if (
//       !absolutePath.startsWith(projectWithSeparator) &&
//       absolutePath !== FileSystemTools.PROJECT_ROOT
//     ) {
//       // Rechaza rutas que intentan salir del directorio del proyecto.
//       return null;
//     }

//     // Retorna la ruta absoluta porque pasó la validación.
//     return absolutePath;
//   }

//   /**
//    * Obtiene el PROJECT_ROOT
//    * @returns PROJECT_ROOT
//    */
//   static getProjectRoot(): string {
//     return FileSystemTools.PROJECT_ROOT;
//   }

//   /**
//    * Construye la ruta completa de un elemento dentro de un directorio.
//    *
//    * @param dirPath Ruta del directorio padre.
//    * @param entryName Nombre del archivo o subdirectorio.
//    * @returns Ruta resultante combinando ambos valores.
//    */
//   static buildFullPath(dirPath: string, entryName: string): string {
//     return path.join(dirPath, entryName);
//   }

//   /**
//    * Obtiene el nombre de un archivo a partir de su ruta
//    * y lo normaliza a minúsculas.
//    *
//    * @param file Ruta absoluta o relativa del archivo.
//    * @returns Nombre del archivo en minúsculas, incluyendo su extensión.
//    *
//    * @example
//    * getNormalizedFileName("./src/utils/config.ts");
//    * "config.ts"
//    */
//   static getNormalizedFileName(file: string): string {
//     return path.basename(file).toLowerCase();
//   }

//   static async readDiretory(dirPath: string): Promise<Dirent<string>[]> {
//     let entries;
//     try {
//       entries = await fsAsync.readdir(dirPath, { withFileTypes: true });
//     } catch {
//       throw new Error(`No se pudo leer el directorio: ${dirPath}`);
//     }

//     return entries;
//   }

//   /**
//    * Garantiza de forma síncrona que exista el directorio padre
//    * de una ruta de archivo.
//    *
//    * Ejemplo:
//    *
//    * data/vector-store.db
//    * ↓
//    * crea el directorio data
//    *
//    * @param filePath Ruta completa del archivo.
//    * @returns `true` si el directorio existe o pudo crearse;
//    *          `false` si ocurrió un error.
//    */
//   static ensureParentDirectory(filePath: string): boolean {
//     try {
//       // Obtiene el directorio padre de la ruta recibida.
//       const directoryPath = path.dirname(filePath);

//       // `recursive: true` evita errores si el directorio ya existe
//       // y crea también los directorios padre que falten.
//       fs.mkdirSync(directoryPath, {
//         recursive: true,
//       });

//       return true;
//     } catch (error) {
//       console.warn(`No se pudo crear el directorio para: ${filePath}`, error);

//       return false;
//     }
//   }

//   /**
//    * Garantiza de forma asíncrona que exista el directorio padre
//    * de una ruta de archivo.
//    *
//    * Ejemplo:
//    *
//    * data/vector-store.db
//    * ↓
//    * crea el directorio data
//    *
//    * @param filePath Ruta completa del archivo.
//    * @returns `true` si el directorio existe o pudo crearse;
//    *          `false` si ocurrió un error.
//    */
//   static async ensureParentDirectoryAsync(filePath: string): Promise<boolean> {
//     try {
//       // Obtiene el directorio padre de la ruta recibida.
//       const directoryPath = path.dirname(filePath);

//       // Crea el directorio y sus padres cuando sea necesario.
//       // No genera error si el directorio ya existe.
//       await fsAsync.mkdir(directoryPath, {
//         recursive: true,
//       });

//       return true;
//     } catch (error) {
//       console.warn(`No se pudo crear el directorio para: ${filePath}`, error);

//       return false;
//     }
//   }

//   /**
//    * Lee el contenido de un archivo de forma asíncrona.
//    *
//    * Por defecto, devuelve el contenido como texto codificado en UTF-8.
//    * Puede recibir otra codificación compatible con Node.js.
//    *
//    * @param filePath Ruta del archivo que se desea leer.
//    * @param encoding Codificación utilizada para interpretar el contenido.
//    * @returns Contenido del archivo como una cadena de texto.
//    *
//    * @throws {Error} Si el archivo no existe, no puede leerse
//    * o no se tienen permisos suficientes.
//    */
//   static async readFile(
//     filePath: string,
//     encoding: BufferEncoding = "utf-8",
//   ): Promise<string> {
//     try {
//       // Lee el archivo usando la codificación indicada.
//       //
//       // Al especificar una codificación, `readFile`
//       // devuelve una cadena en lugar de un Buffer.
//       const content = await fsAsync.readFile(filePath, encoding);

//       // Devuelve el contenido leído.
//       return content;
//     } catch (error) {
//       // Oculta el error interno y lanza uno con contexto
//       // sobre el archivo que no pudo leerse.
//       throw new Error(`No se pudo leer el archivo: ${filePath}`, {
//         cause: error,
//       });
//     }
//   }

//   /**
//    * Crea una nueva ruta reemplazando el nombre del archivo,
//    * pero conservando el mismo directorio padre.
//    *
//    * Ejemplo:
//    *
//    * data/vector-store.db + metadata.json
//    * -> data/metadata.json
//    *
//    * @param filePath Ruta original del archivo.
//    * @param newFileName Nuevo nombre del archivo.
//    * @returns Nueva ruta dentro del mismo directorio.
//    */
//   static replaceFileName(filePath: string, newFileName: string): string {
//     if (!filePath.trim()) {
//       throw new Error("filePath no puede estar vacío.");
//     }

//     if (!newFileName.trim()) {
//       throw new Error("newFileName no puede estar vacío.");
//     }

//     if (path.basename(newFileName) !== newFileName) {
//       throw new Error("newFileName debe ser solo un nombre de archivo.");
//     }
//     // Obtiene la carpeta que contiene el archivo original.
//     const directoryPath = path.dirname(filePath);

//     // Construye una nueva ruta usando la misma carpeta
//     // y el nuevo nombre de archivo.
//     return path.join(directoryPath, newFileName);
//   }

//   /**
//    * Guarda contenido en un archivo.
//    *
//    * Si el directorio padre no existe, lo crea automáticamente.
//    *
//    * @param filePath Ruta donde se escribirá el archivo.
//    * @param content Contenido que se guardará.
//    */
//   static async writeFile(
//     filePath: string,
//     content: string | Buffer,
//     options: BufferEncoding = "utf-8",
//   ): Promise<void> {
//     // Garantiza que exista el directorio padre.
//     await fsAsync.mkdir(path.dirname(filePath), {
//       recursive: true,
//     });

//     // Escribe el contenido en el archivo.
//     await fsAsync.writeFile(filePath, content, options);
//   }
// }
