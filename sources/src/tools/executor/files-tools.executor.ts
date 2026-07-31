import { serialize } from "../../utils/response/index.js";
import { FileSystemToolActions } from "../actions/index.js";

export async function executeFileTool(
  name: string,
  params: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case "list_files": {
        const { path, extension } = params;

        if (path !== undefined && (typeof path !== "string" || !path.trim())) {
          return serialize({
            success: false,
            error: "El parámetro 'path' debe ser un string no vacío.",
          });
        }

        if (
          extension !== undefined &&
          (typeof extension !== "string" || !extension.trim())
        ) {
          return serialize({
            success: false,
            error: "El parámetro 'extension' debe ser un string no vacío.",
          });
        }

        return FileSystemToolActions.getListFiles({
          path: typeof path === "string" ? path.trim() : ".",
          extension:
            typeof extension === "string" ? extension.trim() : undefined,
        });
      }

      case "find_file": {
        const { file_name, path } = params;

        if (typeof file_name !== "string" || !file_name.trim()) {
          return serialize({
            success: false,
            error:
              "El parámetro 'file_name' es requerido y no puede estar vacío.",
          });
        }

        if (path !== undefined && (typeof path !== "string" || !path.trim())) {
          return serialize({
            success: false,
            error: "El parámetro 'path' debe ser un string no vacío.",
          });
        }

        return FileSystemToolActions.findFile({
          file_name: file_name.trim(),
          path: typeof path === "string" ? path.trim() : undefined,
        });
      }

      case "read_file": {
        const { file_path } = params;

        if (typeof file_path !== "string" || !file_path.trim()) {
          return serialize({
            success: false,
            error:
              "El parámetro 'file_path' es requerido y no puede estar vacío.",
          });
        }

        return FileSystemToolActions.readFile({
          file_path: file_path.trim(),
        });
      }

      case "search_file_content": {
        const { searchText, path } = params;

        if (typeof searchText !== "string" || !searchText.trim()) {
          return serialize({
            success: false,
            error:
              "El parámetro 'searchText' es requerido y no puede estar vacío.",
          });
        }

        if (path !== undefined && (typeof path !== "string" || !path.trim())) {
          return serialize({
            success: false,
            error: "El parámetro 'path' debe ser un string no vacío.",
          });
        }

        const result = await FileSystemToolActions.searchFileContent({
          searchText: searchText.trim(),
          path: typeof path === "string" ? path.trim() : undefined,
        });
        // console.log({
        //   matches: result,
        // });
        return result;
      }

      default:
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
    return serialize({
      success: false,
      error:
        error instanceof Error
          ? `Error ejecutando "${name}": ${error.message}`
          : `Error desconocido ejecutando "${name}".`,
    });
  }
}
