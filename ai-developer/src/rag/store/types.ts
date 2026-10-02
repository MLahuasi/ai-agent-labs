/**
 * Representa una fila almacenada en la tabla de chunks.
 *
 * Describe tanto el contenido del fragmento como los metadatos
 * necesarios para identificar su origen y posición dentro
 * del documento original.
 */
export interface ChunkRow {
  /**
   * Identificador único del chunk.
   */
  id: string;

  /**
   * Contenido textual del fragmento.
   */
  content: string;

  /**
   * Origen del documento.
   *
   * Puede ser una ruta de archivo, URL, nombre de documento
   * o cualquier referencia que permita localizar la fuente.
   */
  source: string;

  /**
   * Título o encabezado de la sección a la que pertenece el chunk.
   *
   * Ayuda a conservar el contexto semántico del fragmento.
   */
  heading: string;

  /**
   * Posición u orden del chunk dentro del documento original.
   *
   * Puede utilizarse para ordenar los fragmentos o recuperar
   * los chunks anteriores y siguientes.
   */
  position: number;

  /**
   * Cantidad de caracteres que contiene el chunk.
   *
   * El nombre utiliza snake_case porque normalmente coincide
   * con el nombre de la columna devuelta por SQLite.
   */
  char_count: number;
}

/**
 * Representa una fila obtenida durante una búsqueda vectorial.
 *
 * Incluye todos los campos de ChunkRow y agrega la distancia
 * entre el embedding de la consulta y el embedding del chunk.
 */
export interface SearchRow extends ChunkRow {
  /**
   * Distancia vectorial entre la consulta y el chunk.
   *
   * En la mayoría de las métricas de distancia, un valor menor
   * indica una mayor similitud entre ambos vectores.
   */
  distance: number;
}
