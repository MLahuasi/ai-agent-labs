import { ActionsSettings } from "./index.js";
import { FileSystemTools } from "../../utils/files/file-systems.tools.js";
import { serialize } from "../../utils/response/index.js";

/**
 * Proporciona acciones para consultar archivos y directorios del proyecto.
 */
export class FileSystemToolActions {
  /**
   * Lista los archivos existentes dentro de un directorio.
   *
   * @param params.path Ruta del directorio que se desea listar.
   * @param params.extension Extensión opcional utilizada para filtrar archivos.
   * @return Respuesta serializada con los archivos encontrados.
   */
  static async getListFiles(params: {
    path: string;
    extension?: string;
  }): Promise<string> {
    // Resuelve y valida la ruta dentro del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(params.path);

    // Rechaza rutas externas al proyecto.
    if (!securePath) {
      return serialize({
        success: false,
        error:
          `La ruta "${params.path}" intenta acceder ` + "fuera del proyecto.",
      });
    }

    // Almacena la información de la ruta.
    let stat: Awaited<ReturnType<typeof FileSystemTools.getStat>>;

    try {
      // Obtiene información de la ruta.
      stat = await FileSystemTools.getStat(securePath);
    } catch {
      // Retorna un error si la ruta no puede consultarse.
      return serialize({
        success: false,
        error: `El directorio "${params.path}" no existe o no puede consultarse.`,
      });
    }

    // Comprueba que la ruta sea un directorio.
    if (stat !== undefined && !stat.isDirectory()) {
      return serialize({
        success: false,
        error: `"${params.path}" no es un directorio.`,
      });
    }

    // Obtiene los archivos del directorio.
    const files = await FileSystemTools.collectFiles(
      securePath,
      params.extension,
    );

    // Convierte las rutas y ordena los resultados.
    const relativePaths = files
      .map((file) => FileSystemTools.toRelativePath(file))
      .sort((left, right) => left.localeCompare(right));

    // Retorna los archivos encontrados.
    return serialize({
      success: true,
      operation: "list_files",
      searchedPath: FileSystemTools.toRelativePath(securePath),
      extension: params.extension ?? null,
      count: relativePaths.length,
      files: relativePaths,
    });
  }

  /**
   * Busca un archivo por nombre dentro de un directorio.
   *
   * @param params.file_name Nombre del archivo que se desea buscar.
   * @param params.path Directorio opcional donde se realizará la búsqueda.
   * @return Respuesta serializada con los archivos encontrados.
   */
  static async findFile(params: {
    file_name: string;
    path?: string;
  }): Promise<string> {
    // Define la ruta inicial de búsqueda.
    const searchPath = params.path ?? ".";

    // Resuelve y valida la ruta dentro del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(searchPath);

    // Rechaza rutas externas al proyecto.
    if (!securePath) {
      return serialize({
        success: false,
        error:
          `La ruta "${searchPath}" intenta acceder ` + "fuera del proyecto.",
      });
    }

    // Almacena la información de la ruta.
    let stat: Awaited<ReturnType<typeof FileSystemTools.getStat>>;

    try {
      // Obtiene información de la ruta.
      stat = await FileSystemTools.getStat(securePath);
    } catch {
      // Retorna un error si la ruta no existe.
      return serialize({
        success: false,
        error: `La ruta de búsqueda "${searchPath}" no existe.`,
      });
    }

    // Comprueba que la ruta sea un directorio.
    if (stat !== undefined && !stat.isDirectory()) {
      return serialize({
        success: false,
        error: `"${searchPath}" no es un directorio.`,
      });
    }

    // Normaliza el nombre del archivo.
    const normalizedFileName = params.file_name.trim().toLowerCase();

    // Comprueba que el nombre tenga contenido.
    if (!normalizedFileName) {
      return serialize({
        success: false,
        error: "El nombre del archivo no puede estar vacío.",
      });
    }

    // Obtiene los archivos del directorio.
    const allFiles = await FileSystemTools.collectFiles(securePath);

    // Filtra los archivos por nombre.
    const matchingFiles = allFiles.filter((file) => {
      // Obtiene el nombre normalizado del archivo.
      const currentFileName = FileSystemTools.getLowerCaseFileName(file);

      // Permite una coincidencia parcial cuando se habilite esta opción.
      // if (params.exact_match === false) {
      //   return currentFileName.includes(normalizedFileName);
      // }

      // Realiza una coincidencia exacta.
      return currentFileName === normalizedFileName;
    });

    // Limita, transforma y ordena las coincidencias.
    const limitedMatches = matchingFiles
      .slice(0, ActionsSettings.MAX_FILE_RESULTS)
      .map((file) => FileSystemTools.toRelativePath(file))
      .sort((left, right) => left.localeCompare(right));

    // console.log({
    //   limitedMatches,
    // });

    // Retorna las coincidencias encontradas.
    return serialize({
      success: true,
      operation: "find_files",
      fileName: params.file_name,
      searchedPath: FileSystemTools.toRelativePath(securePath),
      // exactMatch: params.exact_match !== false,
      count: matchingFiles.length,
      truncated: matchingFiles.length > ActionsSettings.MAX_FILE_RESULTS,
      matches: limitedMatches,
    });
  }

  /**
   * Lee un archivo ubicado dentro del proyecto.
   *
   * @param params.file_path Ruta del archivo que se desea leer.
   * @return Respuesta serializada con el contenido del archivo.
   */
  static async readFile(params: { file_path: string }): Promise<string> {
    // Resuelve y valida la ruta dentro del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(params.file_path);

    // Rechaza rutas externas al proyecto.
    if (!securePath) {
      return serialize({
        success: false,
        error:
          `La ruta "${params.file_path}" intenta acceder ` +
          "fuera del proyecto.",
      });
    }

    try {
      // Obtiene información de la ruta.
      const stat = await FileSystemTools.getStat(securePath);

      // Comprueba que la ruta exista.
      if (!stat)
        return serialize({
          success: false,
          error: `"${params.file_path}" no existe o no pudo ser leido `,
        });

      // Rechaza directorios.
      if (stat.isDirectory()) {
        return serialize({
          success: false,
          error: `"${params.file_path}" es un directorio, ` + "no un archivo.",
        });
      }

      // Comprueba que la ruta corresponda a un archivo.
      if (!stat.isFile()) {
        return serialize({
          success: false,
          error: `"${params.file_path}" no es un archivo válido.`,
        });
      }

      // Comprueba el tamaño del archivo.
      if (stat.size > ActionsSettings.MAX_FILE_SIZE) {
        return serialize({
          success: false,
          error:
            `El archivo supera el tamaño máximo permitido de ` +
            `${ActionsSettings.MAX_FILE_SIZE} bytes.`,
        });
      }

      // Lee el contenido del archivo.
      const content = await FileSystemTools.readFile(securePath, "utf-8");

      // Trunca el contenido si supera el límite permitido.
      if (content.length > ActionsSettings.MAX_FILE_SIZE) {
        return (
          content.slice(0, ActionsSettings.MAX_FILE_SIZE) +
          "\n\n... [archivo truncado]"
        );
      }

      // Retorna el contenido del archivo.
      return serialize({
        success: true,
        operation: "read_file",
        filePath: FileSystemTools.toRelativePath(securePath),
        size: stat.size,
        content,
      });
    } catch (error) {
      // Convierte el error al tipo utilizado por Node.js.
      const err = error as NodeJS.ErrnoException;

      // Retorna un error específico si el archivo no existe.
      if (err.code === "ENOENT") {
        return serialize({
          success: false,
          error: `El archivo "${params.file_path}" no existe.`,
        });
      }

      // Retorna un error genérico de lectura.
      return serialize({
        success: false,
        error: `No fue posible leer el archivo ` + `"${params.file_path}".`,
      });
    }
  }

  /**
   * Busca texto dentro del contenido de los archivos.
   *
   * @param params.searchText Texto que se desea buscar.
   * @param params.path Directorio opcional donde se realizará la búsqueda.
   * @param params.file_extension Extensión opcional utilizada para filtrar archivos.
   * @return Respuesta serializada con las coincidencias encontradas.
   */
  static async searchFileContent(params: {
    searchText: string;
    path?: string;
    file_extension?: string;
  }): Promise<string> {
    // Define la ruta inicial de búsqueda.
    const searchPath = params.path ?? ".";

    // Resuelve y valida la ruta dentro del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(searchPath);

    // Rechaza rutas externas al proyecto.
    if (!securePath) {
      return serialize({
        success: false,
        error:
          `La ruta "${searchPath}" intenta acceder ` + "fuera del proyecto.",
      });
    }

    // Almacena la información de la ruta.
    let stat: Awaited<ReturnType<typeof FileSystemTools.getStat>>;

    try {
      // Obtiene información de la ruta.
      stat = await FileSystemTools.getStat(securePath);
    } catch {
      // Retorna un error si la ruta no existe.
      return serialize({
        success: false,
        error: `La ruta de búsqueda "${searchPath}" ` + "no existe.",
      });
    }

    // Comprueba que la ruta sea un directorio.
    if (stat !== undefined && !stat.isDirectory()) {
      return serialize({
        success: false,
        error: `"${searchPath}" no es un directorio.`,
      });
    }

    // Comprueba que exista un texto de búsqueda.
    if (!params.searchText) {
      return serialize({
        success: false,
        error: "El patrón de búsqueda no puede estar vacío.",
      });
    }

    // Obtiene los archivos que serán analizados.
    const files = await FileSystemTools.collectFiles(
      securePath,
      params.file_extension,
    );

    // Almacena las coincidencias encontradas.
    const matches: Array<{
      filePath: string;
      line: number;
      context: Array<{
        line: number;
        content: string;
        match: boolean;
      }>;
    }> = [];

    // Mantiene el número de coincidencias.
    let totalMatches = 0;

    // Recorre los archivos encontrados.
    for (const file of files) {
      // Detiene la búsqueda cuando alcanza el límite.
      if (totalMatches >= ActionsSettings.MAX_SEARCH_RESULTS) {
        break;
      }

      // Almacena el contenido del archivo.
      let content: string;

      try {
        // Lee el contenido del archivo.
        content = await FileSystemTools.readFile(file, "utf-8");
      } catch {
        // Omite archivos que no puedan leerse.
        continue;
      }

      // Divide el contenido en líneas.
      const lines = content.split(/\r?\n/);

      // Recorre las líneas del archivo.
      for (let i = 0; i < lines.length; i++) {
        // Detiene la búsqueda cuando alcanza el límite.
        if (totalMatches >= ActionsSettings.MAX_SEARCH_RESULTS) {
          break;
        }

        // Obtiene la línea actual.
        const currentLine = lines[i] ?? "";

        // Continúa si la línea no contiene el texto.
        if (!currentLine.includes(params.searchText)) {
          continue;
        }

        // Incrementa el número de coincidencias.
        totalMatches++;

        // Calcula la primera línea de contexto.
        const startLine = Math.max(0, i - ActionsSettings.CONTEXT_LINES);

        // Calcula la última línea de contexto.
        const endLine = Math.min(
          lines.length - 1,
          i + ActionsSettings.CONTEXT_LINES,
        );

        // Almacena las líneas de contexto.
        const context: Array<{
          line: number;
          content: string;
          match: boolean;
        }> = [];

        // Recorre las líneas de contexto.
        for (
          let contextIndex = startLine;
          contextIndex <= endLine;
          contextIndex++
        ) {
          context.push({
            // Obtiene el número de línea.
            line: contextIndex + 1,

            // Obtiene el contenido de la línea.
            content: lines[contextIndex] ?? "",

            // Indica si la línea contiene la coincidencia.
            match: contextIndex === i,
          });
        }

        // Agrega la coincidencia encontrada.
        matches.push({
          filePath: FileSystemTools.toRelativePath(file),
          line: i + 1,
          context,
        });
      }
    }

    // Retorna las coincidencias encontradas.
    return serialize({
      success: true,
      operation: "search_file_content",
      searchText: params.searchText,
      searchedPath: FileSystemTools.toRelativePath(securePath),
      fileExtension: params.file_extension ?? null,
      count: totalMatches,

      // Indica si la búsqueda alcanzó el límite de resultados.
      truncated: totalMatches >= ActionsSettings.MAX_SEARCH_RESULTS,

      matches,
    });
  }
}
