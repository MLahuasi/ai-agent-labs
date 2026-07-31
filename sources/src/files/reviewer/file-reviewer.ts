import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MAX_CHARS,
  SUPPORTED_FILE_EXTENSIONS,
} from "../../config/index.js";

import { LlmClient } from "../../types/app/index.js";
import {
  AgentRequest,
  AgentResponse,
  Message,
} from "../../types/agent/index.js";
import {
  FileReviewerMode,
  FileReviewerOptions,
  FileReviewerResponse,
} from "../../types/files/index.js";

/**
 * Revisa archivos utilizando un cliente LLM.
 *
 * La clase:
 * - valida la ruta recibida;
 * - lee el archivo;
 * - controla el tamaño enviado al modelo;
 * - construye el prompt de revisión;
 * - solicita la revisión al LLM;
 * - retorna el resultado junto con sus metadatos.
 */
export class FileReviewer {
  private readonly maxChars: number;
  private readonly rejectUnsupportedExtensions: boolean;

  constructor(
    private readonly llm: LlmClient,
    private readonly prompt: string,
    private readonly systemPrompt: string,
    options: FileReviewerOptions = {},
  ) {
    this.maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
    this.rejectUnsupportedExtensions =
      options.rejectUnsupportedExtensions ?? false;

    if (!Number.isInteger(this.maxChars) || this.maxChars <= 0) {
      throw new Error("maxChars debe ser un número entero mayor que cero");
    }
  }

  /**
   * Revisa un archivo utilizando respuesta completa o streaming.
   */
  async reviewFile(
    filePath: string,
    mode: FileReviewerMode = "complete",
    messages?: Message[],
  ): Promise<FileReviewerResponse> {
    const absolutePath = path.resolve(filePath);

    await this.validateFile(absolutePath);

    const extension = path.extname(absolutePath).toLowerCase();
    const fileName = path.basename(absolutePath);
    const warnings = this.validateExtension(extension);

    const content = await readFile(absolutePath, "utf-8");

    if (!content.trim()) {
      throw new Error(`El archivo "${fileName}" está vacío`);
    }

    const totalLines = this.countLines(content);
    const preparedContent = this.prepareContent(content);

    if (preparedContent.truncated) {
      warnings.push(
        `El archivo supera ${this.maxChars} caracteres. ` +
          "Solo se revisará la primera parte.",
      );
    }

    const prompt = this.buildPrompt({
      prompt: this.prompt,
      fileName,
      extension,
      totalLines,
      content: preparedContent.content,
      truncated: preparedContent.truncated,
    });

    // console.log("-".repeat(50));
    // console.log({
    //   custom_prompt: prompt,
    // });
    // console.log("-".repeat(50));

    const response = await this.requestReview(mode, { prompt, messages });

    return {
      fileName,
      filePath: absolutePath,
      extension,
      totalLines,
      totalCharacters: content.length,
      truncated: preparedContent.truncated,
      reviewedCharacters: preparedContent.content.length,
      warnings,
      review: response.text,
      totalInputTokens: response.totalInputTokens,
      totalOutputTokens: response.totalOutputTokens,
    };
  }

  /**
   * Verifica que la ruta exista y corresponda a un archivo.
   */
  private async validateFile(filePath: string): Promise<void> {
    let fileStats;

    try {
      fileStats = await stat(filePath);
    } catch {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    if (!fileStats.isFile()) {
      throw new Error(`La ruta no corresponde a un archivo: ${filePath}`);
    }
  }

  /**
   * Verifica que la extensión sea conocida.
   *
   * Las extensiones desconocidas pueden generar una advertencia
   * o impedir la revisión según la configuración de la clase.
   */
  private validateExtension(extension: string): string[] {
    if (SUPPORTED_FILE_EXTENSIONS.has(extension)) {
      return [];
    }

    const displayedExtension = extension || "sin extensión";

    if (this.rejectUnsupportedExtensions) {
      throw new Error(`La extensión "${displayedExtension}" no está soportada`);
    }

    return [
      `La extensión "${displayedExtension}" no está registrada como soportada.`,
    ];
  }

  /**
   * Limita el contenido que será enviado al modelo.
   */
  private prepareContent(content: string): {
    content: string;
    truncated: boolean;
  } {
    if (content.length <= this.maxChars) {
      return {
        content,
        truncated: false,
      };
    }

    return {
      content: content.slice(0, this.maxChars),
      truncated: true,
    };
  }

  /**
   * Construye el prompt con los metadatos y el código.
   */
  private buildPrompt(params: {
    prompt: string;
    fileName: string;
    extension: string;
    totalLines: number;
    content: string;
    truncated: boolean;
  }): string {
    const language = params.extension.slice(1) || "text";

    const truncationNotice = params.truncated
      ? [
          "",
          "Nota: el archivo fue truncado por su tamaño.",
          "La revisión debe limitarse al contenido proporcionado.",
        ].join("\n")
      : "";

    return [
      params.prompt,
      "",
      `Archivo: ${params.fileName}`,
      `Extensión: ${params.extension || "desconocida"}`,
      `Líneas del archivo original: ${params.totalLines}`,
      truncationNotice,
      "",
      `\`\`\`${language}`,
      params.content,
      "```",
    ].join("\n");
  }

  /**
   * Envía la solicitud utilizando el modo seleccionado.
   */
  private requestReview(
    mode: FileReviewerMode,
    { prompt, messages }: AgentRequest,
  ): Promise<AgentResponse> {
    if (mode === "stream") {
      return this.llm.stream({
        prompt,
        systemPrompt: this.systemPrompt,
        messages,
      });
    }

    return this.llm.ask({
      prompt,
      systemPrompt: this.systemPrompt,
      messages,
    });
  }

  /**
   * Calcula el número de líneas del archivo.
   */
  private countLines(content: string): number {
    return content.length === 0 ? 0 : content.split(/\r?\n/).length;
  }
}
