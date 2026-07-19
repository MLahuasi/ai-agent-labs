/**
 * Representa la respuesta retornada por la API de chat de Ollama.
 *
 * Esta estructura se utiliza tanto para respuestas completas
 * como para los fragmentos recibidos durante el streaming.
 */
export interface OllamaGenerateResponse {
  /**
   * Nombre del modelo que generó la respuesta.
   *
   * Ejemplo:
   * "qwen2.5-coder:3b"
   */
  model: string;

  /**
   * Mensaje generado por el modelo.
   */
  message: {
    /**
     * Rol asociado al mensaje.
     *
     * Normalmente será "assistant" cuando
     * la respuesta proviene del modelo.
     */
    role: string;

    /**
     * Fragmento o contenido completo generado.
     *
     * En modo streaming puede contener únicamente
     * una parte de la respuesta.
     */
    content: string;
  };

  /**
   * Indica si la generación ha finalizado.
   *
   * - false: todavía existen fragmentos pendientes.
   * - true: la respuesta se completó.
   */
  done: boolean;

  /**
   * Cantidad de tokens procesados como entrada.
   *
   * Ollama normalmente incluye este valor
   * en el último fragmento de la respuesta.
   */
  prompt_eval_count?: number;

  /**
   * Cantidad de tokens generados como salida.
   *
   * Ollama normalmente incluye este valor
   * cuando finaliza la generación.
   */
  eval_count?: number;
}
