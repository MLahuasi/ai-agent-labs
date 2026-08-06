import { Chunk } from "../../types/rag/index.js";
import { FileSystemTools } from "../../utils/files/file-systems.tools.js";

const MAX_CHUNK_SIZE = 200;

export class MarkdownChunkingService {
  private readonly fileName: string;

  private constructor(
    private readonly content: string,
    filePath: string,
    private readonly separator = "##",
  ) {
    this.fileName = FileSystemTools.getLowerCaseFileName(filePath);
  }

  static create(
    content: string,
    filePath: string,
    separator = "##",
  ): MarkdownChunkingService {
    return new MarkdownChunkingService(content, filePath, separator);
  }

  /** Divide el contenido Markdown en chunks con overlap entre párrafos. */
  private chunk(): Chunk[] {
    const chunks: Chunk[] = [];

    // 1. Separar el documento por headings.
    const sections = this.content.split(
      new RegExp(`(?=^${this.separator})`, "m"),
    );

    let position = 0;
    let lastParagraph = "";

    // 2. Procesar cada sección semántica.
    for (const section of sections) {
      const normalizedSection = section.trim();

      if (!normalizedSection) {
        continue;
      }

      // 3. Identificar el heading de la sección.
      const firstLine = normalizedSection.split("\n")[0] ?? "";
      const hasHeading = firstLine.startsWith(`${this.separator} `);
      const heading = hasHeading ? firstLine.trim() : "(Introducción)";

      // 4. Crear un chunk directo cuando la sección no supera el límite.
      if (normalizedSection.length <= MAX_CHUNK_SIZE) {
        const chunkContent = lastParagraph
          ? `${lastParagraph}\n\n${normalizedSection}`
          : normalizedSection;

        chunks.push(this.createChunk(chunkContent, heading, position));

        // 5. Conservar el último párrafo como overlap.
        lastParagraph = this.getLastParagraph(normalizedSection);
        position++;

        continue;
      }

      // 6. Subdividir las secciones grandes por párrafos.
      const paragraphs = normalizedSection
        .split(/\n\n+/)
        .filter((paragraph) => paragraph.trim());

      let currentChunk = lastParagraph;

      // 7. Agrupar párrafos sin superar el tamaño máximo.
      for (const paragraph of paragraphs) {
        const nextContent = currentChunk
          ? `${currentChunk}\n\n${paragraph}`
          : paragraph;

        if (currentChunk && nextContent.length > MAX_CHUNK_SIZE) {
          // 8. Preservar el heading en cada chunk de la sección.
          const chunkContent = hasHeading
            ? `${heading}\n\n${currentChunk.trim()}`
            : currentChunk.trim();

          chunks.push(this.createChunk(chunkContent, heading, position));

          // 9. Repetir el último párrafo en el siguiente chunk.
          lastParagraph = this.getLastParagraph(currentChunk);
          currentChunk = `${lastParagraph}\n\n${paragraph}`;
          position++;

          continue;
        }

        currentChunk = nextContent;
      }

      if (!currentChunk.trim()) {
        continue;
      }

      // 10. Crear el último chunk pendiente de la sección.
      const chunkContent = hasHeading
        ? `${heading}\n\n${currentChunk.trim()}`
        : currentChunk.trim();

      chunks.push(this.createChunk(chunkContent, heading, position));

      // 11. Preparar el overlap para la siguiente sección.
      lastParagraph = this.getLastParagraph(currentChunk);
      position++;
    }

    // 12. Retornar todos los chunks generados.
    return chunks;
  }

  /** Crear un chunk con su identificador y metadatos. */
  private createChunk(
    content: string,
    heading: string,
    position: number,
  ): Chunk {
    return {
      id: `${this.fileName}-${position}`,
      content,
      metadata: {
        source: this.fileName,
        heading,
        position,
        charCount: content.length,
      },
    };
  }

  /** Obtiene el último párrafo para utilizarlo como overlap. */
  private getLastParagraph(content: string): string {
    return content.trim().split(/\n\n+/).at(-1) ?? "";
  }

  /**
   * Lee todos los archivos Markdown de un directorio y genera sus chunks.
   *
   * Cada archivo se procesa mediante una instancia independiente, porque
   * el contenido, nombre y metadatos pertenecen a un documento específico.
   */
  static async getChunks(
    dirPath: string,
    separator: string = "##",
  ): Promise<Chunk[]> {
    const allChuncks: Chunk[] = [];
    let entries;
    try {
      // Obtener los archivos y directorios contenidos en la ruta indicada.
      entries = await FileSystemTools.readDiretory(dirPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";

      console.error(`\nError: ${message}\n`);
      throw error;
    }

    // Seleccionar únicamente archivos Markdown y procesarlos
    // en un orden determinista.
    const markdownFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const file of markdownFiles) {
      // Construir la ruta utilizando el nombre del archivo actual.
      const fullPath = FileSystemTools.buildFullPath(dirPath, file.name);
      let content: string;

      try {
        // Leer el contenido Markdown del archivo.
        content = await FileSystemTools.readFile(fullPath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";

        console.warn(`No se pudo leer ${file.name}: ${message}`);
        continue;
      }

      // Crear una instancia por documento, ya que chunk() depende
      // del contenido, el nombre del archivo y el separador.
      const chunker = new MarkdownChunkingService(content, fullPath, separator);
      const chuncks = chunker.chunk();

      // Agregar los chunks del archivo al resultado global.
      allChuncks.push(...chuncks);
      console.log(
        `Procesando ${file.name}... ${chuncks.length} chuncks generados`,
      );
    }

    return allChuncks;
  }
}

// import { Chunk } from "../../types/rag/index.js";
// import { FileSystemTools } from "../../utils/files/file-systems.tools.js";

// const MAX_CHUNK_SIZE = 200;

// export function chunkMarkdown(content: string, pathFile: string): Chunk[] {
//   const fileName = FileSystemTools.getNormalizedFileName(pathFile);
//   const chunks: Chunk[] = [];

//   const sections = content.split(/(?=^##)/m);

//   let globalPosition = 0;
//   let lastParagraph = "";

//   for (const section of sections) {
//     if (!section.trim()) continue;

//     const lines = section.split("\n");
//     const firstLine = lines[0] ?? "";
//     const isHeading = firstLine.startsWith("## ");
//     const heading = isHeading ? firstLine.trim() : "(Introducción)";

//     if (section.length <= MAX_CHUNK_SIZE) {
//       const chunkContent = lastParagraph
//         ? `${lastParagraph}\n\n${section.trim()}`
//         : section.trim();

//       chunks.push({
//         id: `${fileName}-${globalPosition}`,
//         content: chunkContent,
//         metadata: {
//           source: fileName,
//           heading,
//           position: globalPosition,
//           charCount: chunkContent.length,
//         },
//       });

//       const paragrahs = section.trim().split(/\n\n+/);
//       lastParagraph = paragrahs[paragrahs.length - 1] ?? "";
//       globalPosition++;
//       continue;
//     }

//     const paragrahs = section
//       .trim()
//       .split(/\n\n+/)
//       .filter((paragrah) => paragrah.trim().length > 0);

//     let currentChunk = lastParagraph ? `${lastParagraph}\n\n` : "";
//     for (let i = 0; i < paragrahs.length; i++) {
//       const paragraph = paragrahs[i] ?? "";
//       if (
//         currentChunk.length > 0 &&
//         currentChunk.length + paragraph.length > MAX_CHUNK_SIZE
//       ) {
//         const chunkContent = isHeading
//           ? `${heading}\n\n${currentChunk.trim()}`
//           : currentChunk.trim();

//         chunks.push({
//           id: `${fileName}-${globalPosition}`,
//           content: chunkContent,
//           metadata: {
//             source: fileName,
//             heading,
//             position: globalPosition,
//             charCount: chunkContent.length,
//           },
//         });

//         const chunkParagraps = currentChunk.trim().split(/\n\n+/);
//         lastParagraph = chunkParagraps[chunkParagraps.length - 1] ?? "";
//         currentChunk = `${lastParagraph}\n\n`;
//         globalPosition++;
//       }
//       currentChunk += paragrahs + "\n\n";
//     }

//     if (currentChunk.trim().length > 0) {
//       const chunkContent = isHeading
//         ? `${heading}\n\n${currentChunk.trim()}`
//         : currentChunk.trim();

//       chunks.push({
//         id: `${fileName}-${globalPosition}`,
//         content: chunkContent,
//         metadata: {
//           source: fileName,
//           heading,
//           position: globalPosition,
//           charCount: chunkContent.length,
//         },
//       });

//       const finalParagraps = currentChunk.trim().split(/\n\n+/);
//       lastParagraph = finalParagraps[finalParagraps.length - 1] ?? "";
//       globalPosition++;
//     }
//   }

//   return chunks;
// }
