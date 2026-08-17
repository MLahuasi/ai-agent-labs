import { serialize } from "../../utils/response/index.js";
import { FileSystemToolActions } from "../actions/index.js";

/**
 * Ejecuta una herramienta relacionada con el sistema de archivos.
 *
 * @param name Nombre de la herramienta que se desea ejecutar.
 * @param params Parámetros recibidos por la herramienta.
 * @return Respuesta serializada con el resultado de la operación.
 */
export async function executeFileTool(
  name: string,
  params: Record<string, unknown>,
): Promise<string> {
  try {
    // Determina qué herramienta debe ejecutarse.
    switch (name) {
      case "list_files": {
        // Obtiene los parámetros de listado.
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

        // Ejecuta el listado de archivos.
        return FileSystemToolActions.getListFiles({
          path: typeof path === "string" ? path.trim() : ".",
          extension:
            typeof extension === "string" ? extension.trim() : undefined,
        });
      }

      case "find_file": {
        // Obtiene los parámetros de búsqueda.
        const { file_name, path } = params;

        // Valida que file_name sea un string no vacío.
        if (typeof file_name !== "string" || !file_name.trim()) {
          return serialize({
            success: false,
            error:
              "El parámetro 'file_name' es requerido y no puede estar vacío.",
          });
        }

        // Valida que path sea un string no vacío cuando se proporciona.
        if (path !== undefined && (typeof path !== "string" || !path.trim())) {
          return serialize({
            success: false,
            error: "El parámetro 'path' debe ser un string no vacío.",
          });
        }

        // Ejecuta la búsqueda del archivo.
        return FileSystemToolActions.findFile({
          file_name: file_name.trim(),
          path: typeof path === "string" ? path.trim() : undefined,
        });
      }

      case "read_file": {
        // Obtiene la ruta del archivo.
        const { file_path } = params;

        // Valida que file_path sea un string no vacío.
        if (typeof file_path !== "string" || !file_path.trim()) {
          return serialize({
            success: false,
            error:
              "El parámetro 'file_path' es requerido y no puede estar vacío.",
          });
        }

        // Ejecuta la lectura del archivo.
        return FileSystemToolActions.readFile({
          file_path: file_path.trim(),
        });
      }

      case "search_file_content": {
        // Obtiene los parámetros de búsqueda de contenido.
        const { searchText, path } = params;

        // Valida que searchText sea un string no vacío.
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
        const result = await FileSystemToolActions.searchFileContent({
          searchText: searchText.trim(),
          path: typeof path === "string" ? path.trim() : undefined,
        });

        // console.log({
        //   matches: result,
        // });

        // Retorna el resultado de la búsqueda.
        return result;
      }

      default:
        // Retorna un error cuando la herramienta no existe.
        return serialize({
          success: false,
          error: `Tool desconocida "${name}".`,
          availableTools: [
            "list_files",
            "find_file",
            "read_file",
            "search_file_content",
          ],
        });
    }
  } catch (error) {
    // Retorna un error producido durante la ejecución.
    return serialize({
      success: false,
      error:
        error instanceof Error
          ? `Error ejecutando "${name}": ${error.message}`
          : `Error desconocido ejecutando "${name}".`,
    });
  }
}
