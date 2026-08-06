import * as fs from "fs/promises";

import { ActionsSettings } from "./index.js";
import { FileSystemTools } from "../../utils/files/file-systems.tools.js";
import { serialize } from "../../utils/response/index.js";

/**
 * Proporciona utilidades estáticas para validar rutas y recorrer archivos.
 * No requiere crear instancias de la clase.
 */
export class FileSystemToolActions {
  /**
   * Recorre un directorio y sus subdirectorios para obtener archivos.
   * Opcionalmente filtra los resultados por extensión.
   */
  private static async collectFiles(
    dirPath: string,
    extension?: string,
  ): Promise<string[]> {
    // Inicializa la lista donde se almacenarán los archivos encontrados.
    const results: string[] = [];

    // Declara la lista de elementos encontrados dentro del directorio.
    let entries;

    try {
      // Lee el directorio incluyendo información de archivos y carpetas.
      entries = await fs.readdir(dirPath, {
        withFileTypes: true,
      });
    } catch {
      // Retorna una lista vacía si el directorio no puede leerse.
      return results;
    }

    // Recorre cada archivo o carpeta encontrado.
    for (const entry of entries) {
      // Ignora node_modules y elementos ocultos como .git o .env.
      if (ActionsSettings.shouldIgnoreEntry(entry.name)) {
        // Continúa con el siguiente elemento.
        continue;
      }

      // Construye la ruta completa del elemento actual.
      const fullPath = FileSystemTools.buildFullPath(dirPath, entry.name);

      // Comprueba si el elemento es un directorio.
      if (entry.isDirectory()) {
        // Busca archivos recursivamente dentro del subdirectorio.
        const subFiles = await FileSystemToolActions.collectFiles(
          fullPath,
          extension,
        );

        // Agrega los archivos encontrados al resultado.
        results.push(...subFiles);
        continue;
      }

      if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
        // Agrega el archivo si no hay filtro o coincide con la extensión.
        results.push(fullPath);
      }
    }

    // Retorna todas las rutas de archivos encontradas.
    return results;
  }

  /**
   * Lista de forma recursiva los archivos existentes dentro de un directorio.
   *
   * La función:
   *
   * 1. Valida que la ruta indicada permanezca dentro del proyecto.
   * 2. Comprueba que la ruta exista y corresponda a un directorio.
   * 3. Recorre el directorio y sus subdirectorios.
   * 4. Aplica un filtro por extensión cuando se proporciona.
   * 5. Convierte las rutas absolutas en rutas relativas al proyecto.
   * 6. Ordena los resultados alfabéticamente.
   * 7. Retorna una respuesta serializada y estructurada.
   *
   * @param params.path Ruta del directorio que se desea listar.
   * @param params.extension Extensión opcional para filtrar archivos.
   * @returns Resultado serializado con los archivos encontrados o el error producido.
   */
  static async getListFiles(params: {
    path: string;
    extension?: string;
  }): Promise<string> {
    // Convierte la ruta relativa recibida en una ruta absoluta
    // y verifica que permanezca dentro de la raíz del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(params.path);

    //Si resolveSecurePath retorna null, significa que la ruta
    //intenta acceder fuera del directorio permitido.
    if (!securePath) {
      return serialize({
        success: false,
        error:
          `La ruta "${params.path}" intenta acceder ` + "fuera del proyecto.",
      });
    }

    //Almacena la información del sistema de archivos asociada con la ruta validada.

    let stat: Awaited<ReturnType<typeof fs.stat>>;

    try {
      //fs.stat permite determinar, entre otras cosas, si la ruta corresponde a un archivo o a un directorio.
      stat = await fs.stat(securePath);
    } catch {
      // Retorna un error estructurado cuando la ruta no existe o no puede ser consultada.
      return serialize({
        success: false,
        error: `El directorio "${params.path}" no existe o no puede consultarse.`,
      });
    }

    //Verifica que la ruta corresponda realmente a un directorio.
    if (!stat.isDirectory()) {
      return serialize({
        success: false,
        error: `"${params.path}" no es un directorio.`,
      });
    }

    //Recorre recursivamente el directorio validado y todos sus subdirectorios.
    //Si params.extension tiene un valor, collectFiles solamente retorna archivos cuya extensión coincida con el filtro.
    const files = await FileSystemToolActions.collectFiles(
      // Ruta absoluta validada dentro del proyecto.
      securePath,

      // Filtro opcional por extensión.
      params.extension,
    );

    //Transforma las rutas absolutas obtenidas por collectFiles en rutas relativas a la raíz del proyecto.
    //Después ordena los archivos alfabéticamente para producir una respuesta estable y predecible.
    const relativePaths = files
      .map((file) => FileSystemTools.toRelativePath(file))
      .sort((left, right) => left.localeCompare(right));

    //Retorna un resultado estructurado y serializado.
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
   * Busca archivos por nombre dentro de un directorio del proyecto
   * y todos sus subdirectorios.
   *
   * La función:
   *
   * 1. Determina la ruta desde donde iniciar la búsqueda.
   * 2. Valida que la ruta permanezca dentro del proyecto.
   * 3. Comprueba que la ruta exista y sea un directorio.
   * 4. Normaliza el nombre del archivo buscado.
   * 5. Obtiene recursivamente todos los archivos del directorio.
   * 6. Filtra los archivos por coincidencia exacta o parcial.
   * 7. Limita y ordena los resultados.
   * 8. Retorna una respuesta estructurada y serializada.
   *
   * @param params.file_name Nombre completo o parcial del archivo buscado.
   * @param params.path Directorio opcional desde donde iniciar la búsqueda.
   * @returns Resultado serializado con las rutas encontradas o el error producido.
   */
  static async findFile(params: {
    file_name: string;
    path?: string;
  }): Promise<string> {
    //Define el directorio inicial de búsqueda.
    //Si el usuario o el agente proporcionó una ruta, se utiliza esa ruta.
    //En caso contrario, se utiliza ".", que representa la raíz del proyecto.
    const searchPath = params.path ?? ".";

    // Convierte la ruta recibida en una ruta absoluta y verifica que permanezca dentro de la raíz del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(searchPath);

    //Si resolveSecurePath retorna null, la ruta intenta salir del directorio permitido.
    if (!securePath) {
      return serialize({
        success: false,
        error:
          `La ruta "${searchPath}" intenta acceder ` + "fuera del proyecto.",
      });
    }

    //Almacena los metadatos de la ruta validada.
    let stat: Awaited<ReturnType<typeof fs.stat>>;

    try {
      // fs.stat permite comprobar si la ruta existe y si corresponde a un archivo, directorio u otro tipo de elemento.
      stat = await fs.stat(securePath);
    } catch {
      // Retorna un error estructurado cuando la ruta no existe o no puede ser consultada.
      return serialize({
        success: false,
        error: `La ruta de búsqueda "${searchPath}" no existe.`,
      });
    }

    // Verifica que la ruta inicial corresponda a un directorio. La búsqueda recursiva solo puede realizarse sobre directorios.
    if (!stat.isDirectory()) {
      return serialize({
        success: false,
        error: `"${searchPath}" no es un directorio.`,
      });
    }

    // Normaliza el nombre recibido:
    const normalizedFileName = params.file_name.trim().toLowerCase();

    // Comprueba que el nombre no esté vacío después de eliminar espacios.
    // Esto evita recorrer todo el proyecto con un criterio inválido.
    if (!normalizedFileName) {
      return serialize({
        success: false,
        error: "El nombre del archivo no puede estar vacío.",
      });
    }

    // Obtiene recursivamente todos los archivos existentes dentro del directorio y sus subdirectorios.
    const allFiles = await FileSystemToolActions.collectFiles(securePath);

    // Filtra los archivos encontrados comparando únicamente el nombre de cada archivo, sin incluir su ruta.
    const matchingFiles = allFiles.filter((file) => {
      // Extrae el nombre del archivo incluido en la ruta.
      const currentFileName = FileSystemTools.getLowerCaseFileName(file);

      // Cuando exact_match es false, se realiza una coincidencia parcial.
      // if (params.exact_match === false) {
      //   return currentFileName.includes(normalizedFileName);
      // }

      // En cualquier otro caso se realiza una coincidencia exacta.
      return currentFileName === normalizedFileName;
    });

    // Prepara las coincidencias que serán retornadas.
    //
    // El procesamiento se realiza en tres pasos:
    //
    // 1. slice() limita la cantidad de resultados;
    // 2. map() convierte rutas absolutas en rutas relativas;
    // 3. sort() ordena alfabéticamente las rutas.
    const limitedMatches = matchingFiles
      .slice(0, ActionsSettings.MAX_FILE_RESULTS)
      .map((file) => FileSystemTools.toRelativePath(file))
      .sort((left, right) => left.localeCompare(right));

    // console.log({
    //   limitedMatches,
    // });

    // Retorna una respuesta estructurada y serializada.
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
   * Valida y lee un archivo ubicado dentro del proyecto.
   * Rechaza directorios, archivos inexistentes o demasiado grandes.
   * @param params.file_path Ruta del archivo que se desea leer.
   * @returns Resultado serializado con las rutas encontradas o el error producido.
   */
  static async readFile(params: { file_path: string }): Promise<string> {
    // Resuelve y valida que la ruta permanezca dentro del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(params.file_path);

    // Comprueba si la ruta fue rechazada por seguridad.
    if (!securePath) {
      // Retorna un error si la ruta intenta salir del proyecto.
      return serialize({
        success: false,
        error:
          `La ruta "${params.file_path}" intenta acceder ` +
          "fuera del proyecto.",
      });
    }

    try {
      // Obtiene información del archivo o directorio indicado.
      const stat = await fs.stat(securePath);

      // Comprueba si la ruta corresponde a un directorio.
      if (stat.isDirectory()) {
        // Retorna un error porque solo se pueden leer archivos.
        return serialize({
          success: false,
          error: `"${params.file_path}" es un directorio, ` + "no un archivo.",
        });
      }

      if (!stat.isFile()) {
        // error al leer el archivo.
        return serialize({
          success: false,
          error: `"${params.file_path}" no es un archivo válido.`,
        });
      }

      // Comprueba si el tamaño del archivo supera el límite permitido.
      if (stat.size > ActionsSettings.MAX_FILE_SIZE) {
        // Retorna un aviso sin leer el contenido completo.
        return serialize({
          success: false,
          error:
            `El archivo supera el tamaño máximo permitido de ` +
            `${ActionsSettings.MAX_FILE_SIZE} bytes.`,
        });
      }

      // Lee el contenido completo del archivo como texto UTF-8.
      const content = await fs.readFile(securePath, "utf-8");

      // Comprueba si el contenido leído supera el límite permitido.
      if (content.length > ActionsSettings.MAX_FILE_SIZE) {
        // Retorna solo una parte del contenido e indica que fue truncado.
        return (
          content.slice(0, ActionsSettings.MAX_FILE_SIZE) +
          "\n\n... [archivo truncado]"
        );
      }

      // Retorna el contenido completo del archivo.
      return serialize({
        success: true,
        operation: "read_file",
        filePath: FileSystemTools.toRelativePath(securePath),
        size: stat.size,
        content,
      });
    } catch (error) {
      // Convierte el error al tipo de error utilizado por Node.js.
      const err = error as NodeJS.ErrnoException;

      // Comprueba si el archivo no fue encontrado.
      if (err.code === "ENOENT") {
        // Retorna un mensaje específico para archivos inexistentes.
        return serialize({
          success: false,
          error: `El archivo "${params.file_path}" no existe.`,
        });
      }

      // Retorna un mensaje genérico para cualquier otro error de lectura.
      return serialize({
        success: false,
        error: `No fue posible leer el archivo ` + `"${params.file_path}".`,
      });
    }
  }

  /**
   * Busca un patrón de texto dentro del contenido de los archivos
   * de un directorio y sus subdirectorios.
   *
   * La función:
   *
   * 1. Determina la ruta desde donde iniciar la búsqueda.
   * 2. Valida que la ruta permanezca dentro del proyecto.
   * 3. Comprueba que la ruta exista y sea un directorio.
   * 4. Valida que el patrón de búsqueda no esté vacío.
   * 5. Obtiene recursivamente los archivos que se deben analizar.
   * 6. Lee cada archivo como texto UTF-8.
   * 7. Busca el patrón línea por línea.
   * 8. Construye un bloque de contexto para cada coincidencia.
   * 9. Limita la cantidad máxima de resultados.
   * 10. Retorna una respuesta estructurada y serializada.
   *
   * @param params.searchText Texto literal que se desea buscar.
   * @param params.path Directorio opcional desde donde iniciar la búsqueda.
   * @param params.file_extension Extensión opcional para filtrar archivos.
   * @returns Resultado serializado con las coincidencias o el error producido.
   */
  static async searchFileContent(params: {
    searchText: string;
    path?: string;
    file_extension?: string;
  }): Promise<string> {
    // Define el directorio inicial de búsqueda.
    const searchPath = params.path ?? ".";

    // Convierte la ruta recibida en una ruta absoluta y verifica que permanezca dentro de la raíz del proyecto.
    const securePath = FileSystemTools.resolveSecurePath(searchPath);

    // Si resolveSecurePath retorna null, significa que la ruta intenta salir del directorio permitido.
    if (!securePath) {
      return serialize({
        success: false,
        error:
          `La ruta "${searchPath}" intenta acceder ` + "fuera del proyecto.",
      });
    }

    // Almacena los metadatos asociados a la ruta validada.
    let stat: Awaited<ReturnType<typeof fs.stat>>;

    try {
      // fs.stat permite comprobar si la ruta:
      stat = await fs.stat(securePath);
    } catch {
      // Retorna un error estructurado cuando la ruta no existe o no puede ser consultada.
      return serialize({
        success: false,
        error: `La ruta de búsqueda "${searchPath}" ` + "no existe.",
      });
    }

    // Comprueba que la ruta inicial sea un directorio.
    if (!stat.isDirectory()) {
      return serialize({
        success: false,
        error: `"${searchPath}" no es un directorio.`,
      });
    }

    // Verifica que el patrón contenga algún valor.
    if (!params.searchText) {
      return serialize({
        success: false,
        error: "El patrón de búsqueda no puede estar vacío.",
      });
    }

    // Obtiene recursivamente todos los archivos contenidos dentro del directorio validado.
    const files = await FileSystemToolActions.collectFiles(
      securePath,
      params.file_extension,
    );

    // Almacena todas las coincidencias encontradas.
    const matches: Array<{
      filePath: string;
      line: number;
      context: Array<{
        line: number;
        content: string;
        match: boolean;
      }>;
    }> = [];

    // Mantiene el número total de coincidencias encontradas.
    let totalMatches = 0;

    // Recorre secuencialmente cada archivo encontrado.
    for (const file of files) {
      // Detiene el recorrido de archivos cuando ya se alcanzó la cantidad máxima de resultados permitidos.
      if (totalMatches >= ActionsSettings.MAX_SEARCH_RESULTS) {
        break;
      }

      // Variable que almacenará el contenido completo del archivo actual.
      let content: string;

      try {
        // Lee el archivo como texto utilizando codificación UTF-8.
        content = await fs.readFile(file, "utf-8");
      } catch {
        // Si un archivo no puede leerse, se omite y la búsqueda continúa con el siguiente archivo.
        continue;
      }

      // Divide el contenido en líneas. La expresión regular soporta:
      // - "\n" utilizado normalmente en Linux y macOS;
      // - "\r\n" utilizado normalmente en Windows./
      const lines = content.split(/\r?\n/);

      // Recorre cada línea del archivo actual.
      for (let i = 0; i < lines.length; i++) {
        // Detiene el recorrido de líneas cuando se alcanza la cantidad máxima de resultados.
        if (totalMatches >= ActionsSettings.MAX_SEARCH_RESULTS) {
          break;
        }

        // Obtiene la línea actual. Se utiliza una cadena vacía como fallback para satisfacer el control de índices de TypeScript.
        const currentLine = lines[i] ?? "";

        // Comprueba si la línea contiene literalmente el patrón recibido.
        if (!currentLine.includes(params.searchText)) {
          continue;
        }

        // Incrementa el número de coincidencias después de encontrar el patrón en la línea actual.
        totalMatches++;

        // Calcula el índice inicial del bloque de contexto.
        // CONTEXT_LINES define cuántas líneas anteriores se incluirán.
        // Math.max evita generar índices negativos cuando la coincidencia está cerca del inicio del archivo.
        const startLine = Math.max(0, i - ActionsSettings.CONTEXT_LINES);

        // Calcula el índice final del bloque de contexto.
        // CONTEXT_LINES define cuántas líneas posteriores se incluirán.
        // Math.min evita superar el último índice disponible cuando la coincidencia está cerca del final del archivo.
        const endLine = Math.min(
          lines.length - 1,
          i + ActionsSettings.CONTEXT_LINES,
        );

        // Almacena las líneas incluidas dentro del bloque de contexto de esta coincidencia.
        const context: Array<{
          line: number;
          content: string;
          match: boolean;
        }> = [];

        // Recorre desde la primera línea de contexto hasta la última, incluyendo la línea coincidente.
        for (
          let contextIndex = startLine;
          contextIndex <= endLine;
          contextIndex++
        ) {
          context.push({
            // Convierte el índice interno, basado en cero, en un número de línea legible, basado en uno.
            line: contextIndex + 1,

            // Almacena el contenido de la línea de contexto.
            content: lines[contextIndex] ?? "",

            // Indica si esta es exactamente la línea donde se encontró el patrón.
            // Las demás líneas solo forman parte del contexto.
            match: contextIndex === i,
          });
        }

        // Agrega la coincidencia al arreglo de resultados.
        matches.push({
          filePath: FileSystemTools.toRelativePath(file),
          line: i + 1,
          context,
        });
      }
    }

    // Retorna una respuesta estructurada y serializada.
    return serialize({
      success: true,
      operation: "search_file_content",
      searchText: params.searchText,
      searchedPath: FileSystemTools.toRelativePath(securePath),
      fileExtension: params.file_extension ?? null,
      count: totalMatches,

      // Indica que la búsqueda llegó al límite permitido. Debe interpretarse como: "Puede haber más coincidencias que no fueron procesadas".
      truncated: totalMatches >= ActionsSettings.MAX_SEARCH_RESULTS,

      matches,
    });
  }
}
