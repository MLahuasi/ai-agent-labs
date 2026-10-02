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
