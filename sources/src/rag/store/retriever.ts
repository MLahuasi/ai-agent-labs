import { config } from "../../config/index.js";
import { OpenAiEmbeddingClient } from "../../llm/clients/embedding/index.js";
import type { RetrievedChunk } from "../../types/rag/index.js";
import { VectorStore } from "./index.js";

/**
 * Instancia compartida del almacén vectorial.
 *
 * Se inicializa de forma diferida la primera vez que se necesita,
 * evitando abrir la base de datos durante la carga del módulo.
 */
let vectorStoreInstance: VectorStore | null = null;

/**
 * Obtiene la instancia compartida del almacén vectorial.
 *
 * Si todavía no existe, crea una nueva instancia utilizando
 * la ruta de base de datos configurada en `config.dbPath`.
 *
 * @returns Instancia activa de `VectorStore`.
 */
function getStore(): VectorStore {
  // Inicializa el almacén únicamente en el primer acceso.
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore(config.dbPath);
  }

  // Reutiliza la misma conexión en las siguientes llamadas.
  return vectorStoreInstance;
}

/**
 * Recupera los chunks más relacionados semánticamente con una consulta.
 *
 * El flujo es:
 *
 * 1. Obtiene el almacén vectorial.
 * 2. Verifica que contenga chunks indexados.
 * 3. Genera el embedding de la consulta.
 * 4. Busca los vectores más cercanos.
 * 5. Convierte los resultados al tipo `RetrievedChunk`.
 *
 * @param query Consulta escrita por el usuario.
 * @param topK Cantidad máxima de chunks que se desea recuperar.
 * @returns Chunks más relevantes para la consulta.
 */
export async function retrieveContext(
  query: string,
  topK: number = config.ragTopK,
): Promise<RetrievedChunk[]> {
  /**
   * Obtiene o crea la instancia compartida del vector store.
   */
  const store = getStore();

  /**
   * Si no hay chunks almacenados, no se puede ejecutar
   * una búsqueda semántica.
   */
  if (store.size === 0) {
    console.log(
      "Vector store vacío - usa /ingest para cargar la documentación",
    );

    return [];
  }

  /**
   * Crea el cliente encargado de generar embeddings
   * mediante el proveedor configurado.
   */
  const client = new OpenAiEmbeddingClient();

  /**
   * Convierte la consulta del usuario en un vector numérico.
   *
   * Este vector debe tener las mismas dimensiones y provenir
   * del mismo modelo utilizado durante la ingestión.
   */
  const queryVector = await client.generateEmbedding(query);

  /**
   * Busca los `topK` chunks con menor distancia
   * respecto al embedding de la consulta.
   */
  const topSearchResults = store.search(queryVector, topK);

  /**
   * Convierte los resultados internos del vector store
   * al formato utilizado por la capa RAG.
   *
   * Cada elemento contiene:
   * - el contenido del chunk;
   * - sus metadatos;
   * - el score calculado por la búsqueda.
   */
  const chunks: RetrievedChunk[] = topSearchResults.map((result) => ({
    ...result.chunk,
    score: result.score,
  }));

  /**
   * Limita la consulta mostrada en consola a 50 caracteres
   * para evitar logs demasiado largos.
   */
  const preview = query.length > 50 ? `${query.slice(0, 50)}...` : query;

  console.log(`Buscando: "${preview}" -> ${chunks.length} chunks recuperados`);

  return chunks;
}

/**
 * Cierra y elimina la instancia compartida del vector store.
 *
 * Debe utilizarse cuando:
 * - se reconstruye la base de datos;
 * - finaliza la aplicación;
 * - se necesita volver a abrir la conexión;
 * - se ejecutan pruebas que requieren aislamiento.
 */
export function resetStore(): void {
  // Solo intenta cerrar la conexión cuando existe una instancia activa.
  if (vectorStoreInstance) {
    // Libera la conexión SQLite y sus recursos asociados.
    vectorStoreInstance.close();

    // Elimina la referencia para permitir una nueva inicialización
    // en la próxima llamada a `getStore`.
    vectorStoreInstance = null;
  }
}
