import { config as loadDotenv } from "dotenv";
import {
  AppConfig,
  MODEL_PROVIDERS,
  ModelProvider,
} from "../types/app/index.js";

/**
 * Administra la configuración principal de la aplicación.
 *
 * Responsabilidades:
 * - Cargar las variables definidas en el archivo .env.
 * - Obtener variables de entorno con valores predeterminados.
 * - Validar el proveedor LLM configurado.
 * - Construir el objeto de configuración.
 * - Validar las credenciales necesarias según el proveedor activo.
 */
export class AppConfigService {
  /**
   * Configuración construida a partir de las variables de entorno.
   */
  public readonly config: AppConfig;

  constructor() {
    /**
     * Carga las variables del archivo .env
     * dentro de process.env.
     */
    loadDotenv();

    this.config = this.buildConfig();
  }

  /**
   * Obtiene una variable de entorno.
   *
   * Si la variable no existe, utiliza el valor predeterminado.
   * Si tampoco existe un valor predeterminado, lanza una excepción.
   */
  private getRequiredEnvVar(name: string, defaultValue?: string): string {
    const value = process.env[name] ?? defaultValue;

    if (value === undefined) {
      throw new Error(`Variable de entorno requerida no encontrada: ${name}`);
    }

    return value;
  }

  /**
   * Obtiene una variable de entorno y la convierte
   * a un número entero.
   *
   * Lanza una excepción cuando el valor no representa
   * un número entero válido.
   */
  private getIntegerEnvVar(name: string, defaultValue: string): number {
    const rawValue = this.getRequiredEnvVar(name, defaultValue);
    const value = Number.parseInt(rawValue, 10);

    if (Number.isNaN(value)) {
      throw new Error(
        `La variable de entorno ${name} debe contener un número entero válido`,
      );
    }

    return value;
  }

  private getBooleanEnvVar(name: string, defaultValue: string): boolean {
    const rawValue = this.getRequiredEnvVar(name, defaultValue)
      .trim()
      .toLowerCase();

    const trueValues = ["true", "1", "yes", "on"];
    const falseValues = ["false", "0", "no", "off"];

    if (trueValues.includes(rawValue)) {
      return true;
    }

    if (falseValues.includes(rawValue)) {
      return false;
    }

    throw new Error(
      `La variable de entorno ${name} debe contener un valor booleano válido`,
    );
  }

  /**
   * Obtiene una variable de entorno como número decimal.
   *
   * @param name Nombre de la variable de entorno.
   * @param defaultValue Valor utilizado cuando la variable no está definida.
   * @return Valor decimal obtenido.
   */
  private getNumberEnvVar(name: string, defaultValue: string): number {
    const rawValue = this.getRequiredEnvVar(name, defaultValue);
    const value = Number.parseFloat(rawValue);

    if (Number.isNaN(value)) {
      throw new Error(
        `La variable de entorno ${name} debe contener un número válido`,
      );
    }

    return value;
  }

  /**
   * Valida que el proveedor recibido se encuentre
   * dentro de la lista de proveedores soportados.
   */
  private validateProvider(value: string): ModelProvider {
    if (MODEL_PROVIDERS.includes(value as ModelProvider)) {
      return value as ModelProvider;
    }

    throw new Error(`Proveedor no válido: ${value}`);
  }

  /**
   * Construye la configuración completa de la aplicación
   * utilizando las variables disponibles en process.env.
   */
  private buildConfig(): AppConfig {
    const rawProvider = process.env["MODEL_PROVIDER"] ?? "anthropic";

    return {
      // LLMS SETTINGS
      /**
       * Configuración de Anthropic.
       */
      anthropicApiKey: this.getRequiredEnvVar("ANTHROPIC_API_KEY", ""),
      anthropicModel: this.getRequiredEnvVar(
        "ANTHROPIC_MODEL",
        "claude-sonnet-4-6",
      ),
      /**
       * Configuración de OpenAI.
       */
      openaiApiKey: this.getRequiredEnvVar("OPENAI_API_KEY", ""),
      openaiModel: this.getRequiredEnvVar("OPENAI_MODEL", "gpt-4o-mini"),
      /**
       * Configuración de Gemini.
       */
      geminiApiKey: this.getRequiredEnvVar("GEMINI_API_KEY", ""),
      geminiModel: this.getRequiredEnvVar(
        "GEMINI_MODEL",
        "gemini-2.5-flash-lite",
      ),
      /**
       * Configuración de Groq.
       */
      groqApiKey: this.getRequiredEnvVar("GROQ_API_KEY", ""),
      groqModel: this.getRequiredEnvVar("GROQ_MODEL", "llama-3.1-8b-instant"),

      /**
       * Configuración de Ollama.
       */
      ollamaHost: this.getRequiredEnvVar("OLLAMA_HOST", ""),
      ollamaModel: this.getRequiredEnvVar("OLLAMA_MODEL", "qwen2.5-coder:3b"),

      // === CONFIGURACIÓN DEL MODELO ===
      /**
       * Proveedor LLM utilizado por la aplicación.
       */
      provider: this.validateProvider(rawProvider),
      /**
       * Número máximo de tokens generados por el modelo.
       */
      max_tokens: this.getIntegerEnvVar("MAX_TOKENS", "1024"),
      /**
       * Imprimir logs respuestas llms
       */
      print_logs: this.getBooleanEnvVar("PRINT_LOGS", "false"),

      // ==== RAG ====
      /**
       * Modelo de embeddings utilizado para generar vectores en OpenAI.
       */
      openaiEmbeddingModel: this.getRequiredEnvVar(
        "OPENAI_EMBEDDING_MODEL",
        "text-embedding-3-small",
      ),
      /**
       * Ruta donde se encuentran los documentos a indexar o consultar.
       */
      docsPath: this.getRequiredEnvVar("DOCS_PATH", "./docs/sample_docs"),
      /**
       * Ruta donde se almacena la base de datos vectorial.
       */
      dbPath: this.getRequiredEnvVar("DB_PATH", "./data/vectors.db"),
      /**
       * Número máximo de chunks devueltos durante una búsqueda RAG.
       */
      ragTopK: this.getIntegerEnvVar("RAG_TOP_K", "5"),
      /**
       * Separador de secciones del archivo
       */
      separator: this.getRequiredEnvVar("SEPARATOR", "##"),
      /**
       * Extension de archivo que se usará en RAG
       */
      extention: this.getRequiredEnvVar("EXTENTION", ".md"),
      /**
       * Tamaño del Chunk
       */
      targetChunkSize: this.getIntegerEnvVar("TARGET_CHUNK_SIZE", "200"),
      /**
       * Se usa para definir un porcentaje +- de extensión de un RAG
       */
      chunkSizeTolerance: this.getNumberEnvVar("CHUNK_SIZE_TOLERANCE", "0.1"),
      /**
       * Evita ciclos indefinidos cuando el modelo solicita herramientas repetidamente.
       */
      max_iterations: this.getIntegerEnvVar("MAX_ITERATIONS", "10"),
      max_tool_calls: this.getIntegerEnvVar("MAX_TOOL_CALLS", "8"),
      max_tokens_tools: this.getIntegerEnvVar("MAX_TOKENS_TOOLS", "4096"),
    };
  }

  /**
   * Valida que la configuración mínima necesaria
   * esté disponible para el proveedor activo.
   *
   * Solo se valida la credencial o dirección requerida
   * por el proveedor seleccionado.
   */
  public validate(): void {
    switch (this.config.provider) {
      case "anthropic":
        this.validateRequiredValue(
          this.config.anthropicApiKey,
          "ANTHROPIC_API_KEY",
        );
        break;

      case "openai":
        this.validateRequiredValue(this.config.openaiApiKey, "OPENAI_API_KEY");
        break;

      case "gemini":
        this.validateRequiredValue(this.config.geminiApiKey, "GEMINI_API_KEY");
        break;

      case "groq":
        this.validateRequiredValue(this.config.groqApiKey, "GROQ_API_KEY");
        break;

      case "ollama":
        this.validateRequiredValue(this.config.ollamaHost, "OLLAMA_HOST");
        break;
    }
  }

  /**
   * Comprueba que un valor requerido no esté vacío.
   */
  private validateRequiredValue(value: string, variableName: string): void {
    if (!value.trim()) {
      throw new Error(
        `${variableName} está vacía. Agrégala en tu archivo .env`,
      );
    }
  }
}

/**
 * Instancia única del servicio de configuración.
 *
 * Se crea al importar este módulo, manteniendo el mismo
 * comportamiento de la implementación original.
 */
export const appConfigService = new AppConfigService();

/**
 * Configuración principal de la aplicación.
 *
 * Esta exportación conserva compatibilidad con los módulos
 * que actualmente importan directamente `config`.
 */
export const config = appConfigService.config;

/**
 * Valida la configuración correspondiente
 * al proveedor seleccionado.
 *
 * Esta función se conserva para no modificar
 * las llamadas existentes en la aplicación.
 */
export function validateConfig(): void {
  appConfigService.validate();
}

/**
 * Exportación predeterminada compatible
 * con la implementación anterior.
 */
export default config;
