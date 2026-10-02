import { serialize } from "../../../../../utils/response/index.js";
import { ToolActions } from "../actions/tool.actions.js";

/**
 * Ejecuta una herramienta según su nombre y valida sus parámetros.
 *
 * Cada herramienta es responsable de validar y normalizar sus argumentos
 * antes de delegar la operación a `ToolActions`.
 *
 * @param name Nombre de la herramienta que se desea ejecutar.
 * @param params Parámetros recibidos por la herramienta.
 * @returns Resultado serializado generado por la herramienta.
 */
export async function executeTool(
  name: string,
  params: Record<string, unknown>,
): Promise<string> {
  // Determina qué herramienta debe ejecutarse según el nombre recibido.
  switch (name) {
    case "list_files": {
      // Obtiene los parámetros necesarios para listar archivos.
      const { path, extension } = params;

      // Valida que path sea un string no vacío cuando se proporciona.
      if (path !== undefined && (typeof path !== "string" || !path.trim())) {
        return serialize({
          success: false,
          error: "El parámetro 'path' debe ser un string no vacío.",
        });
      }

      // Valida que extension sea un string no vacío cuando se proporciona.
      if (
        extension !== undefined &&
        (typeof extension !== "string" || !extension.trim())
      ) {
        return serialize({
          success: false,
          error: "El parámetro 'extension' debe ser un string no vacío.",
        });
      }

      // Ejecuta el listado utilizando valores previamente validados y normalizados.
      return ToolActions.executeListFiles({
        path: typeof path === "string" ? path.trim() : ".",
        extension: typeof extension === "string" ? extension.trim() : undefined,
      });
    }

    case "read_file": {
      // Obtiene la ruta del archivo que se desea leer.
      const { file_path } = params;

      // Valida que file_path sea un string requerido y no vacío.
      if (typeof file_path !== "string" || !file_path.trim()) {
        return serialize({
          success: false,
          error:
            "El parámetro 'file_path' es requerido y no puede estar vacío.",
        });
      }

      // Ejecuta la lectura utilizando la ruta normalizada.
      return ToolActions.executeReadFile({
        file_path: file_path.trim(),
      });
    }

    case "search_code": {
      // Obtiene el texto y la ruta opcional donde se realizará la búsqueda.
      const { searchText, path } = params;

      // Valida que searchText sea un string requerido y no vacío.
      if (typeof searchText !== "string" || !searchText.trim()) {
        return serialize({
          success: false,
          error:
            "El parámetro 'searchText' es requerido y no puede estar vacío.",
        });
      }

      // Valida que path sea un string no vacío cuando se proporciona.
      if (path !== undefined && (typeof path !== "string" || !path.trim())) {
        return serialize({
          success: false,
          error: "El parámetro 'path' debe ser un string no vacío.",
        });
      }

      // Ejecuta la búsqueda dentro del contenido de los archivos.
      return ToolActions.executeSearchCode({
        searchText: searchText.trim(),
        path: typeof path === "string" ? path.trim() : undefined,
      });
    }

    case "search_docs": {
      // Obtiene la consulta y la cantidad opcional de resultados solicitados.
      const { query, top_k } = params;

      // Valida que query sea un string requerido y no vacío.
      if (typeof query !== "string" || !query.trim()) {
        return serialize({
          success: false,
          error: "El parámetro 'query' es requerido y no puede estar vacío.",
        });
      }

      // Valida que top_k sea un entero positivo cuando se proporciona.
      if (
        top_k !== undefined &&
        (typeof top_k !== "number" || !Number.isInteger(top_k) || top_k <= 0)
      ) {
        return serialize({
          success: false,
          error: "El parámetro 'top_k' debe ser un número entero positivo.",
        });
      }

      // Ejecuta la búsqueda semántica dentro de la documentación indexada.
      return ToolActions.executeSearchDocs({
        query: query.trim(),
        top_k: typeof top_k === "number" ? top_k : undefined,
      });
    }

    case "create_issue": {
      // Obtiene los datos necesarios para crear el issue.
      const { title, description, labels, priority } = params;

      // Valida que title sea un string requerido y no vacío.
      if (typeof title !== "string" || !title.trim()) {
        return serialize({
          success: false,
          error: "El parámetro 'title' es requerido y no puede estar vacío.",
        });
      }

      // Valida que description sea un string requerido y no vacío.
      if (typeof description !== "string" || !description.trim()) {
        return serialize({
          success: false,
          error:
            "El parámetro 'description' es requerido y no puede estar vacío.",
        });
      }

      // Valida que labels sea un arreglo de strings no vacíos cuando se proporciona.
      if (
        labels !== undefined &&
        (!Array.isArray(labels) ||
          !labels.every(
            (label) => typeof label === "string" && label.trim().length > 0,
          ))
      ) {
        return serialize({
          success: false,
          error:
            "El parámetro 'labels' debe ser un arreglo de strings no vacíos.",
        });
      }

      // Valida que priority sea un string no vacío cuando se proporciona.
      if (
        priority !== undefined &&
        (typeof priority !== "string" || !priority.trim())
      ) {
        return serialize({
          success: false,
          error: "El parámetro 'priority' debe ser un string no vacío.",
        });
      }

      // Ejecuta la creación del issue utilizando valores validados y normalizados.
      return ToolActions.executeCreateIssue({
        title: title.trim(),
        description: description.trim(),
        labels: Array.isArray(labels)
          ? labels.map((label) => (label as string).trim())
          : undefined,
        priority: typeof priority === "string" ? priority.trim() : undefined,
      });
    }

    default:
      // Retorna un error cuando el nombre recibido no corresponde a una tool conocida.
      return serialize({
        success: false,
        error:
          `Tool desconocida '${name}'. ` +
          "Tools disponibles: list_files, read_file, search_code, search_docs, create_issue.",
      });
  }
}
