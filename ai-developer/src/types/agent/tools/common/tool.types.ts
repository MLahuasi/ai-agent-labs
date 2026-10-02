/**
 * Define la estructura de una herramienta disponible para el modelo.
 */
export interface ToolDefinition {
  /**
   * Nombre de la herramienta.
   */
  name: string;

  /**
   * Descripción de la funcionalidad de la herramienta.
   */
  description: string;

  /**
   * Esquema de los parámetros aceptados por la herramienta.
   */
  input_schema: {
    /**
     * Tipo raíz del esquema.
     */
    type: "object";

    /**
     * Propiedades aceptadas por la herramienta.
     */
    properties: Record<string, unknown>;

    /**
     * Propiedades requeridas para ejecutar la herramienta.
     */
    required?: string[];

    /**
     * Configuración para propiedades adicionales.
     */
    additionalProperties?: Record<string, unknown>;
  };
}

/**
 * Representa el resultado exitoso de una herramienta.
 *
 * @template T Datos retornados por la operación.
 */
export type ToolSuccess<T extends Record<string, unknown>> = {
  /**
   * Indica que la operación finalizó correctamente.
   */
  success: true;
} & T;

/**
 * Representa el resultado fallido de una herramienta.
 */
export type ToolError = {
  /**
   * Indica que la operación no finalizó correctamente.
   */
  success: false;

  /**
   * Describe el error producido.
   */
  error: string;

  /**
   * Identifica opcionalmente la operación ejecutada.
   */
  operation?: string;

  /**
   * Lista opcional de herramientas disponibles.
   */
  availableTools?: string[];
};

/**
 * Representa el resultado de la ejecución de una herramienta.
 *
 * @template T Datos retornados cuando la operación es exitosa.
 */
export type ToolResult<T extends Record<string, unknown>> =
  | ToolSuccess<T>
  | ToolError;

/**
 * Representa una llamada a una herramienta solicitada por el modelo.
 */
export interface ToolCall {
  /**
   * Identificador opcional generado para la llamada.
   */
  id?: string;

  /**
   * Nombre de la herramienta que se desea ejecutar.
   */
  name: string;

  /**
   * Argumentos proporcionados a la herramienta.
   */
  arguments: Record<string, unknown>;
}

/**
 * Define la función responsable de ejecutar una herramienta.
 *
 * @param name Nombre de la herramienta que se desea ejecutar.
 * @param params Parámetros recibidos por la herramienta.
 * @return Resultado serializado de la ejecución.
 */
export type ToolExecutionHandler = (
  name: string,
  params: Record<string, unknown>,
) => Promise<string>;
