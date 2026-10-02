import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

import { FileSystemTools } from "../../utils/files/file-systems.tools.js";
import { Chunk, SearchResult } from "../../types/rag/index.js";

import { serializeEmbedding } from "../embedding/tools.js";
import { SearchRow } from "./types.js";

/**
 * Almacén vectorial local basado en SQLite.
 *
 * Utiliza:
 * - `better-sqlite3` para acceder a SQLite desde Node.js.
 * - `sqlite-vec` para almacenar y buscar embeddings.
 *
 * Mantiene los datos en dos tablas:
 * - `chunks`: almacena el contenido y los metadatos.
 * - `chunk_embeddings`: almacena los vectores asociados a cada chunk.
 */
export class VectorStore {
  /**
   * Conexión activa con la base de datos SQLite.
   */
  private db: Database.Database;

  /**
   * Crea una instancia del almacén vectorial.
   *
   * @param dbPath Ruta del archivo SQLite.
   */
  constructor(dbPath: string) {
    /**
     * Intenta crear el directorio necesario para almacenar
     * el archivo de la base de datos.
     */
    FileSystemTools.ensurePath(dbPath);

    /**
     * Abre la base de datos existente o crea una nueva
     * en la ruta indicada.
     */
    this.db = new Database(dbPath);

    /**
     * Carga la extensión sqlite-vec en esta conexión.
     *
     * Esto registra las funciones y tablas virtuales necesarias
     * para almacenar y consultar embeddings.
     */
    sqliteVec.load(this.db);

    /**
     * Activa Write-Ahead Logging.
     *
     * WAL mejora la concurrencia entre operaciones de lectura
     * y escritura en SQLite.
     */
    this.db.pragma("journal_mode = WAL");

    /**
     * Reduce la cantidad de sincronizaciones completas con disco.
     *
     * NORMAL suele ofrecer un buen equilibrio entre rendimiento
     * y durabilidad cuando se utiliza WAL.
     */
    this.db.pragma("synchronous = NORMAL");

    /**
     * Crea las tablas necesarias si todavía no existen.
     */
    this.createTables();
  }

  /**
   * Crea las tablas utilizadas por el almacén vectorial.
   */
  private createTables(): void {
    /**
     * Tabla relacional que almacena el contenido de cada chunk
     * y sus metadatos.
     *
     * El embedding no se guarda en esta tabla.
     */
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        heading TEXT NOT NULL,
        position INTEGER NOT NULL,
        char_count INTEGER NOT NULL
      )
    `);

    /**
     * Tabla virtual administrada por sqlite-vec.
     *
     * `chunk_id` relaciona el embedding con el registro correspondiente
     * de la tabla `chunks`.
     *
     * `embedding float[1536]` establece que todos los embeddings deben
     * tener exactamente 1536 dimensiones.
     */
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0 (
        chunk_id TEXT PARTITION KEY,
        embedding float[1536]
      )
    `);
  }

  /**
   * Inserta o reemplaza un chunk y su embedding.
   *
   * @param chunk Chunk con su contenido y metadatos.
   * @param embedding Vector numérico asociado al chunk.
   */
  insert(chunk: Chunk, embedding: number[]): void {
    /**
     * Prepara la inserción del contenido y los metadatos.
     *
     * `INSERT OR REPLACE` elimina y vuelve a insertar el registro
     * cuando ya existe un chunk con el mismo `id`.
     */
    const insertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (
        id,
        content,
        source,
        heading,
        position,
        char_count
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    /**
     * Guarda el chunk en la tabla relacional.
     */
    insertChunk.run(
      chunk.id,
      chunk.content,
      chunk.metadata.source,
      chunk.metadata.heading,
      chunk.metadata.position,
      chunk.metadata.charCount,
    );

    /**
     * Prepara la inserción del embedding.
     *
     * El embedding debe serializarse como un Buffer binario
     * antes de enviarlo a sqlite-vec.
     */
    const insertEmbedding = this.db.prepare(`
      INSERT OR REPLACE INTO chunk_embeddings (
        chunk_id,
        embedding
      )
      VALUES (?, ?)
    `);

    /**
     * Guarda el vector utilizando el mismo identificador del chunk.
     */
    insertEmbedding.run(chunk.id, serializeEmbedding(embedding));
  }

  /**
   * Busca los chunks más similares a un embedding de consulta.
   *
   * @param queryEmbedding Embedding generado a partir de la consulta.
   * @param topk Cantidad máxima de resultados que se desea recuperar.
   * @returns Resultados ordenados desde el más similar al menos similar.
   */
  search(queryEmbedding: number[], topk: number): SearchResult[] {
    /**
     * Ejecuta una búsqueda vectorial sobre la tabla virtual.
     *
     * `MATCH ?` recibe el embedding de consulta.
     * `k = ?` limita la cantidad de vecinos recuperados.
     *
     * Luego se realiza un JOIN con `chunks` para recuperar
     * el contenido y los metadatos correspondientes.
     */
    const stmt = this.db.prepare(`
      SELECT
        c.id,
        c.content,
        c.source,
        c.heading,
        c.position,
        c.char_count,
        e.distance
      FROM chunk_embeddings e
      JOIN chunks c
        ON c.id = e.chunk_id
      WHERE e.embedding MATCH ?
        AND k = ?
      ORDER BY e.distance
    `);

    /**
     * Serializa el embedding de consulta y ejecuta la sentencia.
     *
     * El cast a `SearchRow[]` describe el formato esperado
     * de las filas devueltas por SQLite.
     */
    const rows = stmt.all(
      serializeEmbedding(queryEmbedding),
      topk,
    ) as SearchRow[];

    /**
     * Convierte las filas de SQLite al tipo público SearchResult.
     *
     * La distancia se transforma en un score aproximado:
     *
     * score = 1 - distance / 2
     *
     * La interpretación de este score depende de la métrica
     * de distancia utilizada por sqlite-vec.
     */
    return rows.map((row) => ({
      chunk: {
        id: row.id,
        content: row.content,
        metadata: {
          source: row.source,
          heading: row.heading,
          position: row.position,
          charCount: row.char_count,
        },
      },
      score: 1 - row.distance / 2,
    }));
  }

  /**
   * Elimina todos los embeddings y chunks almacenados.
   *
   * Primero se eliminan los embeddings y luego los chunks
   * para mantener un orden lógico entre ambas tablas.
   */
  clear(): void {
    this.db.exec("DELETE FROM chunk_embeddings");
    this.db.exec("DELETE FROM chunks");
  }

  /**
   * Devuelve la cantidad total de chunks almacenados.
   */
  get size(): number {
    const row = this.db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM chunks
      `,
      )
      .get() as { count: number };

    return row.count;
  }

  /**
   * Cierra la conexión con SQLite.
   *
   * La instancia no debería volver a utilizarse después
   * de ejecutar este método.
   */
  close(): void {
    this.db.close();
  }
}
