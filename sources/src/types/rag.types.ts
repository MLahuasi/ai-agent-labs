/**
 * Representa un fragmento de contenido indexado para búsqueda.
 */
export interface Chunk {
  /** Identificador único del fragmento. */
  id: string;

  /** Texto o contenido asociado al fragmento. */
  content: string;

  /** Metadatos que describen el origen y contexto del fragmento. */
  metadata: {
    /** Fuente de donde proviene el contenido (archivo, URL, documento, etc.). */
    source: string;

    /** Título o encabezado de la sección a la que pertenece el fragmento. */
    heading: string;

    /** Posición del fragmento dentro de la fuente original. */
    position: number;

    /** Cantidad de caracteres del contenido del fragmento. */
    charCount: number;
  };
}

/**
 * Fragmento recuperado por el motor de búsqueda junto con su puntuación
 * de relevancia.
 */
export interface RetrievedChunk extends Chunk {
  /** Puntaje de relevancia calculado para este resultado. */
  score: number;
}

/**
 * Resultado de búsqueda compuesto por un fragmento y su puntuación.
 */
export interface SearchResult {
  /** Fragmento de contenido encontrado. */
  chunk: Chunk;

  /** Puntaje de similitud o relevancia asociado al fragmento. */
  score: number;
}
