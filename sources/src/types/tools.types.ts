/**
 * Define la estructura de una herramienta que puede ser registrada
 * y utilizada por un modelo de IA mediante el mecanismo de Tool Use.
 */
export interface ToolDefinition {
  /**
   * Nombre único de la herramienta.
   * El modelo utiliza este valor para identificar y solicitar
   * la ejecución de la herramienta.
   *
   * Ejemplo: "searchDocuments"
   */
  name: string;

  /**
   * Descripción funcional de la herramienta.
   * Ayuda al modelo a determinar cuándo debe utilizarla.
   *
   * Ejemplo:
   * "Busca documentos relevantes en la base de conocimiento."
   */
  description: string;

  /**
   * Esquema JSON que define los parámetros de entrada requeridos
   * para ejecutar la herramienta.
   */
  input_schema: {
    /**
     * Tipo raíz del esquema.
     * Generalmente debe ser "object".
     */
    type: "object";

    /**
     * Conjunto de propiedades o parámetros que acepta la herramienta.
     * La clave representa el nombre del parámetro y el valor su definición.
     */
    properties: Record<string, unknown>;

    /**
     * Lista opcional de propiedades obligatorias.
     * Si se especifica, el modelo deberá proporcionar estos campos
     * al invocar la herramienta.
     *
     * Ejemplo:
     * ["query", "language"]
     */
    required?: string[];
  };
}

/**
 * Resultado devuelto por una herramienta después de su ejecución.
 *
 * Este objeto se envía al modelo para que pueda procesar la salida
 * de la herramienta y generar una respuesta final para el usuario.
 */
export interface ToolResult {
  /**
   * Nombre de la herramienta ejecutada.
   *
   * Debe coincidir con el nombre definido en ToolDefinition.
   *
   * Ejemplo: "searchDocuments"
   */
  toolName: string;

  /**
   * Identificador único de la invocación.
   *
   * Permite asociar este resultado con la solicitud
   * original realizada por el modelo.
   */
  toolUseId: string;

  /**
   * Resultado generado por la herramienta.
   *
   * Puede contener datos, texto, resultados de búsquedas
   * o cualquier información necesaria para continuar
   * el flujo de conversación.
   */
  result: string;

  /**
   * Indica si la ejecución de la herramienta produjo un error.
   *
   * - true: ocurrió un error durante la ejecución.
   * - false: la ejecución fue exitosa.
   */
  isError: boolean;
}
