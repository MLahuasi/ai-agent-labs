import { ToolDefinition } from "../../types/agent/index.js";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "list_files",
    description:
      "Lista recursivamente los archivos visibles contenidos en un directorio y sus subdirectorios. " +
      "Úsala cuando el usuario quiera explorar una carpeta, conocer qué archivos contiene " +
      "o listar archivos de un tipo determinado. " +
      "No lee el contenido de los archivos. " +
      "Ignora archivos y directorios ocultos, dependencias y archivos de sistema excluidos por la aplicación. " +
      "Si el usuario no especifica un directorio, usa la raíz del proyecto.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Ruta del directorio que se desea recorrer, relativa a la raíz del proyecto. " +
            "Ejemplos: '.', './src', './src/config'. " +
            "Debe representar un directorio, no un archivo. " +
            "Si el usuario no especifica una ruta, usa '.'. " +
            "Conserva la ruta indicada y no agregues nombres de archivo ni extensiones.",
        },
        extension: {
          type: "string",
          description:
            "Extensión exacta utilizada para filtrar los archivos, incluyendo el punto inicial. " +
            "Derívala del lenguaje o tipo de archivo indicado por el usuario. " +
            "Ejemplos: TypeScript corresponde a '.ts', C# a '.cs' y Python a '.py'. " +
            "Si el usuario no especifica un tipo de archivo, omite esta propiedad.",
        },
      },
      required: [],
    },
  },
  {
    name: "find_file",
    description:
      "Busca recursivamente un archivo visible por su nombre completo y exacto. " +
      "Úsala cuando el usuario quiera localizar un archivo específico. " +
      "Si el usuario proporciona un directorio, inicia la búsqueda desde esa ubicación. " +
      "Si no proporciona una ruta, busca desde la raíz del proyecto. " +
      "No acepta nombres parciales, no busca texto dentro de archivos y no lee su contenido. " +
      "Ignora archivos y directorios ocultos, dependencias y archivos de sistema excluidos por la aplicación. " +
      "Si el usuario solicita el contenido, utiliza read_file después de encontrar la ruta.",
    input_schema: {
      type: "object",
      properties: {
        file_name: {
          type: "string",
          description:
            "Nombre completo y exacto del archivo, incluyendo su extensión. " +
            "Ejemplos: 'request.ts', 'appsettings.json', 'user.service.cs'. " +
            "No incluyas una ruta, no agregues extensiones y no uses fragmentos del nombre.",
        },
        path: {
          type: "string",
          description:
            "Directorio desde donde se realizará la búsqueda recursiva, relativo a la raíz del proyecto. " +
            "Ejemplos: '.', './src', './src/types'. " +
            "Debe representar un directorio existente. " +
            "Si el usuario no especifica una ruta, omite esta propiedad.",
        },
      },
      required: ["file_name"],
    },
  },
  {
    name: "read_file",
    description:
      "Lee y devuelve el contenido completo y literal de un archivo visible del proyecto. " +
      "Úsala cuando conozcas una ruta exacta y verificada, normalmente obtenida mediante find_file. " +
      "También puede utilizarse directamente cuando el usuario proporciona la ruta completa. " +
      "No acepta directorios, rutas inventadas, archivos ocultos ni archivos de sistema excluidos por la aplicación. " +
      "Si el usuario solicita mostrar el contenido, reproduce literalmente el contenido retornado.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description:
            "Ruta exacta y completa del archivo, relativa a la raíz del proyecto. " +
            "Debe incluir los directorios, el nombre y la extensión. " +
            "Ejemplos: './src/config/index.ts', './src/types/request.ts'. " +
            "Utiliza solamente una ruta indicada por el usuario o retornada por find_file.",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "search_file_content",
    description:
      "Busca un texto literal dentro del contenido de los archivos visibles de un directorio y sus subdirectorios. " +
      "Úsala cuando el usuario solicite archivos que contienen una palabra o frase, " +
      "o quiera localizar referencias, usos, apariciones u ocurrencias de un símbolo. " +
      "Si el usuario proporciona un directorio, limita la búsqueda a esa ubicación. " +
      "Si no proporciona una ruta, busca desde la raíz del proyecto. " +
      "No busca archivos por nombre. " +
      "Ignora archivos y directorios ocultos, dependencias y archivos de sistema excluidos por la aplicación.",
    input_schema: {
      type: "object",
      properties: {
        searchText: {
          type: "string",
          description:
            "Texto literal exacto que debe buscarse dentro de los archivos. No usar expresiones regulares, escapes ni comodines." +
            "Copia exactamente el texto indicado por el usuario, eliminando únicamente " +
            "espacios accidentales al inicio o al final. " +
            "Ejemplos: 'getListFiles', 'class UserService', 'import OpenAI'.",
        },
        path: {
          type: "string",
          description:
            "Directorio desde donde se realizará la búsqueda recursiva, relativo a la raíz del proyecto. " +
            "Ejemplos: '.', './src', './src/tools'. " +
            "Debe representar un directorio existente. " +
            "Si el usuario no especifica una ruta, omite esta propiedad.",
        },
      },
      required: ["searchText"],
    },
  },
];
