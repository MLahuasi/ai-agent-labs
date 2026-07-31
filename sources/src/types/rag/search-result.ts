import { Chunk } from "./index.js";

/**
 * Resultado de búsqueda compuesto por un fragmento y su puntuación.
 */
export interface SearchResult {
  /** Fragmento de contenido encontrado. */
  chunk: Chunk;

  /** Puntaje de similitud o relevancia asociado al fragmento. */
  score: number;
}
