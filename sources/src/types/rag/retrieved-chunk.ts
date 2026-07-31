import { Chunk } from "./index.js";

/**
 * Fragmento recuperado por el motor de búsqueda junto con su puntuación
 * de relevancia.
 */
export interface RetrievedChunk extends Chunk {
  /** Puntaje de relevancia calculado para este resultado. */
  score: number;
}
