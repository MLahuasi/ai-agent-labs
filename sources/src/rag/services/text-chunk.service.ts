import { Chunk } from "../../types/rag/index.js";
import { FileSystemTools } from "../../utils/files/file-systems.tools.js";

export type ChunkingFileExtension = ".md" | ".txt";
export class TextChunkingService {
  private readonly fileName: string;

  private constructor(
    private readonly content: string,
    filePath: string,
    private readonly separator: string,
    private readonly targetChunkSize: number,
    private readonly chunkSizeTolerance: number,
  ) {
    this.fileName = FileSystemTools.getLowerCaseFileName(filePath);
  }

  /**
   * Lee los archivos permitidos de un directorio y genera sus chunks.
   *
   * @param dirPath Ruta del directorio que contiene los archivos.
   * @param separator Separador utilizado para dividir las secciones.
   * @param extension Extensión de archivo que se procesará.
   * @param targetChunkSize Tamaño objetivo de cada chunk.
   * @param chunkSizeTolerance Tolerancia permitida respecto al tamaño objetivo.
   * @return Chunks generados a partir de los archivos procesados.
   */
  static async getChunks(
    dirPath: string,
    separator: string,
    extension: ChunkingFileExtension,
    targetChunkSize: number,
    chunkSizeTolerance: number,
  ): Promise<Chunk[]> {
    const allChunks: Chunk[] = [];
    let entries;

    try {
      // Obtiene los archivos y directorios contenidos en la ruta.
      entries = await FileSystemTools.readDiretory(dirPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";

      console.error(`\nError: ${message}\n`);
      throw error;
    }

    // Selecciona los archivos con la extensión indicada y los ordena por nombre.
    const files = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.toLowerCase().endsWith(extension.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const file of files) {
      // Construye la ruta del archivo actual.
      const fullPath = FileSystemTools.buildFullPath(dirPath, file.name);

      let content: string;

      try {
        // Lee el contenido del archivo.
        content = await FileSystemTools.readFile(fullPath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";

        console.warn(`No se pudo leer ${file.name}: ${message}`);
        continue;
      }

      // Crea una instancia con la configuración recibida.
      const chunker = new TextChunkingService(
        content,
        fullPath,
        separator,
        targetChunkSize,
        chunkSizeTolerance,
      );

      const chunks = chunker.chunk();

      // Agrega los chunks generados al resultado global.
      allChunks.push(...chunks);

      console.log(
        `Procesando ${file.name}... ${chunks.length} chunks generados`,
      );
    }

    return allChunks;
  }

  /**
   * Divide el contenido en chunks respetando el tamaño máximo.
   *
   * @return Chunks generados a partir del contenido.
   */
  private chunk(): Chunk[] {
    const chunks: Chunk[] = [];

    // Separa el contenido en secciones cuando existe un separador.
    const sections = this.separator
      ? this.content.split(
          new RegExp(`(?=^${this.escapeRegExp(this.separator)})`, "m"),
        )
      : [this.content];

    let position = 0;

    for (const section of sections) {
      const normalizedSection = section.trim();

      if (!normalizedSection) {
        continue;
      }

      // Obtiene el heading y lo separa del contenido de la sección.
      const lines = normalizedSection.split("\n");
      const firstLine = lines[0] ?? "";

      const hasHeading = this.separator
        ? firstLine.startsWith(`${this.separator} `)
        : false;

      const heading = hasHeading ? firstLine.trim() : "(Contenido)";

      const sectionContent = hasHeading
        ? lines.slice(1).join("\n").trim()
        : normalizedSection;

      // Divide directamente la sección cuando el heading ocupa el límite disponible.
      if (hasHeading && heading.length + 2 >= this.targetChunkSize) {
        const parts = this.splitByMaxSize(
          normalizedSection,
          this.targetChunkSize,
        );

        for (const part of parts) {
          chunks.push(this.createChunk(part, heading, position));
          position++;
        }

        continue;
      }

      const targetContentSize = hasHeading
        ? this.targetChunkSize - heading.length - 2
        : this.targetChunkSize;

      const maxChunkSize = Math.ceil(
        this.targetChunkSize * (1 + this.chunkSizeTolerance),
      );

      const maxContentSize = hasHeading
        ? maxChunkSize - heading.length - 2
        : maxChunkSize;

      // Omite líneas vacías entre los párrafos.
      const paragraphs = sectionContent
        .split(/\n\s*\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

      // Conserva secciones que contienen únicamente un heading.
      if (!paragraphs.length && hasHeading) {
        chunks.push(this.createChunk(heading, heading, position));
        position++;

        continue;
      }

      let currentChunk = "";

      // El overlap comienza vacío en cada sección.
      let lastParagraph = "";

      for (const paragraph of paragraphs) {
        // Divide los párrafos que superan el tamaño disponible.
        const parts = this.splitByMaxSize(paragraph, targetContentSize);

        for (const part of parts) {
          const nextContent = currentChunk
            ? `${currentChunk}\n\n${part}`
            : part;

          if (nextContent.length <= maxContentSize) {
            currentChunk = nextContent;
            continue;
          }

          // Guarda el chunk acumulado antes de continuar.
          const chunkContent = hasHeading
            ? `${heading}\n\n${currentChunk}`
            : currentChunk;

          chunks.push(this.createChunk(chunkContent, heading, position));
          position++;

          // Conserva overlap únicamente dentro de la sección actual.
          lastParagraph = this.getLastParagraph(currentChunk);

          const contentWithOverlap = lastParagraph
            ? `${lastParagraph}\n\n${part}`
            : part;

          currentChunk =
            contentWithOverlap.length <= maxContentSize
              ? contentWithOverlap
              : part;
        }
      }

      if (!currentChunk) {
        continue;
      }

      // Agrega el último chunk pendiente de la sección.
      const chunkContent = hasHeading
        ? `${heading}\n\n${currentChunk}`
        : currentChunk;

      chunks.push(this.createChunk(chunkContent, heading, position));
      position++;
    }

    return chunks;
  }

  /**
   * Divide un texto utilizando un tamaño objetivo con tolerancia.
   *
   * @param content Texto que se dividirá.
   * @param targetSize Tamaño objetivo de cada fragmento.
   * @return Fragmentos generados.
   */
  private splitByMaxSize(content: string, targetSize: number): string[] {
    const parts: string[] = [];

    const minSize = Math.floor(targetSize * (1 - this.chunkSizeTolerance));

    const maxSize = Math.ceil(targetSize * (1 + this.chunkSizeTolerance));

    let start = 0;

    while (start < content.length) {
      const remaining = content.length - start;

      // Conserva el contenido restante cuando está dentro del límite permitido.
      if (remaining <= maxSize) {
        const part = content.slice(start).trim();

        if (part) {
          parts.push(part);
        }

        break;
      }

      const targetEnd = start + targetSize;
      const minEnd = start + minSize;
      const maxEnd = Math.min(start + maxSize, content.length);

      let previousSpace = -1;
      let nextSpace = -1;

      // Busca el espacio anterior más cercano al tamaño objetivo.
      for (let index = targetEnd; index >= minEnd; index--) {
        if (/\s/.test(content[index] ?? "")) {
          previousSpace = index;
          break;
        }
      }

      // Busca el espacio siguiente más cercano al tamaño objetivo.
      for (let index = targetEnd; index <= maxEnd; index++) {
        if (/\s/.test(content[index] ?? "")) {
          nextSpace = index;
          break;
        }
      }

      let end = maxEnd;

      if (previousSpace !== -1 && nextSpace !== -1) {
        const previousDistance = targetEnd - previousSpace;
        const nextDistance = nextSpace - targetEnd;

        end = previousDistance <= nextDistance ? previousSpace : nextSpace;
      } else if (previousSpace !== -1) {
        end = previousSpace;
      } else if (nextSpace !== -1) {
        end = nextSpace;
      }

      const part = content.slice(start, end).trim();

      if (part) {
        parts.push(part);
      }

      // Omite los espacios antes de continuar con el siguiente fragmento.
      start = end;

      while (start < content.length && /\s/.test(content[start] ?? "")) {
        start++;
      }
    }

    return parts;
  }

  /**
   * Crea un chunk con su identificador y metadatos.
   *
   * @param content Contenido del chunk.
   * @param heading Heading asociado al contenido.
   * @param position Posición del chunk dentro del documento.
   * @return Chunk generado.
   */
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

  /**
   * Obtiene el último párrafo del contenido.
   *
   * @param content Contenido del que se obtiene el párrafo.
   * @return Último párrafo encontrado.
   */
  private getLastParagraph(content: string): string {
    return content.trim().split(/\n\n+/).at(-1) ?? "";
  }

  /**
   * Escapa los caracteres especiales utilizados por expresiones regulares.
   *
   * @param value Texto que se escapará.
   * @return Texto preparado para utilizarse en una expresión regular.
   */
  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
