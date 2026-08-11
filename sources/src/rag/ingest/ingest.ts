import config from "../../config/env.settings.js";
import { OpenAiEmbeddingClient } from "../../llm/clients/embedding/index.js";
import { FileSystemTools } from "../../utils/files/file-systems.tools.js";
import {
  ChunkingFileExtension,
  TextChunkingService,
} from "../services/index.js";

import { VectorStore } from "../store/index.js";

/**
 * Ruta del archivo de preview.
 *
 * Se crea en el mismo directorio donde se encuentra
 * la base de datos configurada en `config.dbPath`.
 */
const PREVIEW_JSON = FileSystemTools.buildFilePath(
  config.dbPath,
  "chunks-preview.json",
);

/**
 * Ejecuta el proceso completo de ingestión de documentos Markdown.
 *
 * El flujo es:
 *
 * 1. Leer los documentos Markdown.
 * 2. Dividirlos en chunks.
 * 3. Generar embeddings para cada chunk.
 * 4. Crear un archivo JSON de preview.
 * 5. Guardar los chunks y embeddings en SQLite.
 *
 * @param docsPath Directorio que contiene los documentos Markdown.
 */
export async function runIngest(
  docsPath: string,
  separator: string,
  extension: ChunkingFileExtension,
  targetChunkSize: number,
  chunkSizeTolerance: number,
): Promise<void> {
  console.log("Iniciando la ingestión de documentos..");
  console.log(`Directorio: ${docsPath}`);
  console.log("");

  /**
   * Lee los documentos Markdown encontrados en `docsPath`
   * y genera los chunks correspondientes.
   */
  const chunks = await TextChunkingService.getChunks(
    docsPath,
    separator,
    extension,
    targetChunkSize,
    chunkSizeTolerance,
  );

  /**
   * Informa cuando no se encontraron chunks.
   *
   * Esto normalmente indica que no existen archivos Markdown
   * válidos dentro del directorio configurado.
   */
  if (chunks.length === 0) {
    console.log("No se encuentran archivos .md en el directorio");
  }

  console.log(`Total de chunks generados ${chunks.length}`);

  console.log(`Generando embeddings para ${chunks.length} chunks...`);

  /**
   * Extrae únicamente el contenido textual de cada chunk.
   *
   * Estos textos serán enviados al modelo de embeddings.
   */
  const texts = chunks.map((chunk) => chunk.content);

  /**
   * Crea el cliente encargado de comunicarse con OpenAI.
   */
  const embeddingClient = new OpenAiEmbeddingClient();

  /**
   * Genera un embedding por cada texto.
   *
   * El orden de los embeddings debe corresponder
   * con el orden original de los chunks.
   */
  const embeddings = await embeddingClient.generateEmbeddings(texts);

  /**
   * Obtiene la cantidad de dimensiones del primer embedding.
   *
   * Se asume que todos los embeddings generados por el mismo modelo
   * tienen la misma cantidad de dimensiones.
   */
  const dimensions = embeddings[0]?.length ?? 0;

  console.log(`Embeddings generados ${dimensions} dimensiones c/u`);

  /**
   * Construye una vista resumida de los chunks y embeddings.
   *
   * El contenido se limita a 200 caracteres para evitar
   * generar un archivo demasiado grande.
   *
   * También se incluyen únicamente los primeros cinco valores
   * de cada embedding como referencia visual.
   */
  const preview = chunks.map((chunk, index) => ({
    id: chunk.id,

    /**
     * Vista previa del contenido.
     */
    content:
      chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),

    /**
     * Metadatos originales del chunk.
     */
    metadata: chunk.metadata,

    /**
     * Primeros cinco valores del embedding.
     */
    embeddingsPreview: (embeddings[index] ?? []).slice(0, 5),

    /**
     * Cantidad total de dimensiones del embedding.
     */
    embeddingDims: embeddings[index]?.length ?? 0,
  }));

  /**
   * Garantiza que exista la ruta donde se guardará el preview.
   *
   * Dependiendo de la implementación de `ensurePathAsync`,
   * también puede crear el archivo vacío si todavía no existe.
   */
  await FileSystemTools.ensurePathAsync(PREVIEW_JSON);

  /**
   * Serializa el preview como JSON legible
   * y lo guarda utilizando codificación UTF-8.
   */
  await FileSystemTools.writeFile(
    PREVIEW_JSON,
    JSON.stringify(preview, null, 2),
    "utf-8",
  );

  console.log(`\nGuardando en vector store SQLite: ${config.dbPath}`);

  /**
   * Inicializa el almacén vectorial SQLite.
   */
  const store = new VectorStore(config.dbPath);

  /**
   * Elimina los chunks y embeddings existentes.
   *
   * Esto hace que cada ingestión reconstruya completamente
   * el índice vectorial.
   */
  store.clear();

  /**
   * Recorre los chunks y embeddings en paralelo por índice.
   *
   * Cada chunk debe corresponder al embedding ubicado
   * en la misma posición.
   */
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const embedding = embeddings[index];

    /**
     * Inserta únicamente cuando existen ambos valores.
     */
    if (chunk && embedding) {
      store.insert(chunk, embedding);
    }
  }

  console.log(`Vector store guardado ${store.size} chunks en ${config.dbPath}`);

  console.log(`\nTotal: ${chunks.length} chunks procesados`);

  console.log(`\nPreview en: ${PREVIEW_JSON}`);

  console.log("\nIngestión completa, listo para la búsqueda semántica");
}
