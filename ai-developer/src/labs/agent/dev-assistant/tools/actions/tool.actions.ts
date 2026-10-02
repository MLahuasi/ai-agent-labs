import { FileSystemTools } from "../../../../../utils/files/file-systems.tools.js";
import { ActionsSettings } from "../../../../../tools/actions/index.js";
import { serialize } from "../../../../../utils/response/index.js";
import { retrieveContext } from "../../../../../rag/store/index.js";

export class ToolActions {
  /**
   * Lista los archivos existentes dentro de un directorio.
   *
   * @param params.path Ruta del directorio que se desea listar.
   * @param params.extension Extensión opcional utilizada para filtrar archivos.
   * @return Respuesta serializada con los archivos encontrados.
   */
  static async executeListFiles(params: {
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
   * Lee un archivo ubicado dentro del proyecto.
   *
   * @param params.file_path Ruta del archivo que se desea leer.
   * @return Respuesta serializada con el contenido del archivo.
   */
  static async executeReadFile(params: { file_path: string }): Promise<string> {
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
  static async executeSearchCode(params: {
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

  /**
   * Busca documentación relevante utilizando una consulta de texto.
   *
   * @param params.query Consulta utilizada para buscar documentación.
   * @param params.top_k Cantidad máxima de resultados que se desean obtener.
   * @return Respuesta serializada con los documentos encontrados.
   */
  static async executeSearchDocs(params: {
    query: string;
    top_k?: number;
  }): Promise<string> {
    try {
      // Limita la cantidad de resultados a un máximo de 10.
      const topK = Math.min(params.top_k ?? 5, 10);

      // Obtiene los fragmentos de documentación relacionados con la consulta.
      const chunks = await retrieveContext(params.query, topK);

      // Retorna un error si no se encontraron documentos relevantes.
      if (chunks.length === 0)
        return serialize({
          success: false,
          error:
            "No se encontraron documentos relevantes para esta consulta" +
            "Asegúrate de haber ingestado documentación con el comando /ingest",
        });

      // Transforma los fragmentos encontrados en un formato legible.
      const results = chunks
        .map((chunk) => {
          // Obtiene la fuente del documento.
          const source = chunk.metadata.source;

          // Obtiene la sección asociada al fragmento.
          const section = chunk.metadata.heading;

          // Convierte la relevancia a porcentaje.
          const score = (chunk.score * 100).toFixed(0);

          // Retorna el fragmento con su información de referencia.
          return `[FUENTE: ${source} | Sección: ${section} | Relevancia: ${score}%\n${chunk.content}]`;
        })
        .join("\n\n---\n\n");

      // Retorna los documentos encontrados.
      return serialize({
        success: true,
        operation: "search_docs",
        count: chunks.length,
        matches: results,
      });
    } catch (error) {
      // Obtiene un mensaje legible del error.
      const message = error instanceof Error ? error.message : String(error);

      // Retorna el error producido durante la búsqueda.
      return serialize({
        success: false,
        error: `Error al buscar documentación: ${message}.`,
      });
    }
  }

  /**
   * Crea un issue y lo guarda como archivo Markdown.
   *
   * @param params.title Título del issue.
   * @param params.description Descripción del issue.
   * @param params.labels Etiquetas opcionales asociadas al issue.
   * @param params.priority Prioridad opcional del issue.
   * @return Respuesta serializada con el resultado de la operación.
   */
  static async executeCreateIssue(params: {
    title: string;
    description: string;
    labels?: string[];
    priority?: string;
  }): Promise<string> {
    try {
      // Define el directorio donde se almacenan los issues.
      const issuesDir = "./issues";

      // Garantiza que exista el directorio de issues.
      await FileSystemTools.createDirectoryAsync(issuesDir);

      // Obtiene los archivos existentes en el directorio.
      const existingFiles = await FileSystemTools.readDiretory(issuesDir);

      // Filtra únicamente los archivos Markdown.
      const existingIssues = existingFiles.filter((file) =>
        file.name.endsWith(".md"),
      );

      // Calcula el número del nuevo issue.
      const issueNumber = existingIssues.length + 1;

      // Formatea el número utilizando tres dígitos.
      const formatterNumber = String(issueNumber).padStart(3, "0");

      // Construye el nombre del archivo.
      const fileName = `issue-${formatterNumber}.md`;

      // Construye la ruta completa del issue.
      const fullPath = FileSystemTools.buildFullPath(issuesDir, fileName);

      // Obtiene la fecha actual.
      const date = new Date().toISOString().substring(0, 10);

      // Prepara las etiquetas del issue.
      const labelsStr = params.labels?.join(", ") ?? "sin etiquetas";

      // Define la prioridad del issue.
      const priority = params.priority ?? "medium";

      // Construye el contenido Markdown del issue.
      const content = `
# Issue #${issueNumber}: ${params.title}
## Metadata
- **Fecha:** ${date}
- **Prioridad:** ${priority}
- **Etiquetas:** ${labelsStr}
- **Estado:** abierto
## Descripción
${params.description}
---
*Issue creado automáticamente por Robotitus*
`;

      // Guarda el issue en el sistema de archivos.
      await FileSystemTools.writeFile(fullPath, content, "utf-8");

      // Retorna el resultado de la creación.
      return serialize({
        success: true,
        operation: "create_issue",
        title: params.title,
        message: `Issue creado satisfactoriamente: ${fullPath}`,
      });
    } catch (error) {
      // Obtiene un mensaje legible del error.
      const message = error instanceof Error ? error.message : String(error);

      // Retorna el error producido durante la creación.
      return serialize({
        success: false,
        error: `Error al crear issue: ${message}.`,
      });
    }
  }
}
