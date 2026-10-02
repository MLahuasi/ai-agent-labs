import {
  DEFAULT_MAX_CHARS,
  SUPPORTED_FILE_EXTENSIONS,
} from "../../config/index.js";
import { AgentRequest, AgentResponse } from "../../types/agent/index.js";
import { LlmClient } from "../../types/app/index.js";
import { FileSystemTools } from "../../utils/files/file-systems.tools.js";
import type {
  FileReviewRequest,
  FileReviewerOptions,
  FileReviewerResponse,
} from "../types/file-reviewer.types.js";

/**
 * Servicio responsable de preparar y ejecutar revisiones de archivos
 * mediante un cliente LLM.
 */
export class FileReviewerService {
  private readonly maxChars: number;
  private readonly rejectUnsupportedExtensions: boolean;

  private constructor(
    private readonly llm: LlmClient,
    private readonly llmOptions: Pick<
      AgentRequest,
      "maxTokens" | "maxTokensTools" | "maxIterations"
    >,
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
   * Crea una instancia del servicio de revisión.
   *
   * @param llm Cliente LLM utilizado para generar la revisión.
   * @param llmOptions Configuración de ejecución del LLM.
   * @param options Configuración específica del revisor.
   * @return Instancia de FileReviewerService.
   */
  static create(
    llm: LlmClient,
    llmOptions: Pick<
      AgentRequest,
      "maxTokens" | "maxTokensTools" | "maxIterations"
    >,
    options: FileReviewerOptions = {},
  ): FileReviewerService {
    return new FileReviewerService(llm, llmOptions, options);
  }

  /**
   * Revisa un archivo utilizando el modelo configurado.
   *
   * @param request Datos de la revisión.
   * @return Resultado completo de la revisión.
   */
  async review(request: FileReviewRequest): Promise<FileReviewerResponse> {
    const absolutePath = FileSystemTools.resolveProjectPath(request.filePath);

    await this.validateFile(absolutePath);

    const fileName = FileSystemTools.getFileName(absolutePath);
    const extension = FileSystemTools.getFileExtension(absolutePath);

    const warnings = this.validateExtension(extension);

    const content = await FileSystemTools.readFile(absolutePath);

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
      prompt: request.prompt,
      fileName,
      extension,
      totalLines,
      content: preparedContent.content,
      truncated: preparedContent.truncated,
    });

    const response = await this.requestReview({
      prompt,
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      mode: request.mode ?? "complete",
      onChunk: request.onChunk,
    });

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
      question: prompt,
    };
  }

  /**
   * Verifica que la ruta corresponda a un archivo.
   */
  private async validateFile(filePath: string): Promise<void> {
    const fileStats = await FileSystemTools.getStat(filePath);

    if (!fileStats || !fileStats.isFile()) {
      throw new Error(`La ruta no corresponde a un archivo: ${filePath}`);
    }
  }

  /**
   * Verifica si la extensión del archivo está soportada.
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
   * Prepara el contenido respetando el máximo configurado.
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
   * Construye el prompt final enviado al modelo.
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
   * Ejecuta la llamada al proveedor LLM.
   */
  private requestReview(request: {
    prompt: string;
    systemPrompt?: string;
    messages?: FileReviewRequest["messages"];
    mode: FileReviewRequest["mode"];
    onChunk?: AgentRequest["onChunk"];
  }): Promise<AgentResponse> {
    const llmRequest: AgentRequest = {
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      maxTokens: this.llmOptions.maxTokens,
      maxTokensTools: this.llmOptions.maxTokensTools,
      maxIterations: this.llmOptions.maxIterations,
      onChunk: request.onChunk,
    };

    if (request.mode === "stream") {
      return this.llm.stream(llmRequest);
    }

    return this.llm.ask(llmRequest);
  }

  /**
   * Calcula el número de líneas del contenido.
   */
  private countLines(content: string): number {
    return content.split(/\r?\n/).length;
  }
}
