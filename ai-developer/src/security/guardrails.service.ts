import { GuardrailResult, GuardrailsConfig } from "./guardrails.types.js";
import { INJECTION_PATTERNS } from "./injection-patterns.js";

/**
 * Servicio encargado de aplicar las validaciones de seguridad
 * sobre las entradas recibidas antes de enviarlas al agente o al LLM.
 *
 * Actualmente aplica tres capas:
 *
 * 1. Sanitización del contenido.
 * 2. Detección heurística de prompt injection.
 * 3. Limitación de la frecuencia de solicitudes.
 */
export class GuardrailsService {
  /**
   * Timestamps de las solicitudes registradas
   * dentro de la ventana activa.
   */
  private requestTimestamps: number[] = [];

  /**
   * Crea una nueva instancia del servicio de guardrails.
   *
   * @param config Configuración utilizada por las validaciones de seguridad.
   */
  constructor(private readonly config: GuardrailsConfig) {}

  /**
   * Ejecuta las validaciones de seguridad definidas para
   * una entrada antes de enviarla al agente o al LLM.
   *
   * El flujo realiza las siguientes comprobaciones:
   *
   * 1. Sanitiza la entrada recibida.
   * 2. Detecta posibles intentos de prompt injection.
   * 3. Verifica que no se haya alcanzado el límite de solicitudes.
   *
   * @param input Texto original proporcionado por el usuario.
   * @returns Resultado de las validaciones de seguridad aplicadas.
   */
  checkInput(input: string): GuardrailResult {
    // 1. Sanitizar la entrada y limitar su longitud máxima.
    const sanitized = this.sanitizeInput(input);

    // 2. Detectar posibles intentos de prompt injection.
    const injectionCheck = this.detectPromptInjection(sanitized);

    if (injectionCheck.detected) {
      return {
        safe: false,
        reason:
          "Tu mensaje contiene patrones que intentan modificar el comportamiento del asistente.\n" +
          "Por favor reformula tu pregunta",
        sanitized,
      };
    }

    // 3. Verificar el límite de solicitudes.
    if (!this.checkRateLimit()) {
      return {
        safe: false,
        reason:
          `Se alcanzó el límite de solicitudes. ` +
          `Intenta nuevamente dentro de ${this.window} segundos.`,
        sanitized,
      };
    }

    // La entrada superó todas las validaciones configuradas.
    return {
      safe: true,
      sanitized,
    };
  }

  /**
   * Sanitiza una entrada antes de enviarla al flujo del agente o al LLM.
   *
   * @param input Texto original proporcionado como entrada.
   * @returns Texto sanitizado y limitado a la longitud máxima permitida.
   */
  sanitizeInput(input: string): string {
    let result = input
      // Eliminar null bytes.
      .replace(/\0/g, "")

      // Permitir como máximo dos saltos de línea consecutivos.
      .replace(/\n{3,}/g, "\n\n")

      // Eliminar caracteres ASCII de control,
      // conservando tabulaciones y saltos de línea.
      .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");

    // Truncar entradas que excedan la longitud máxima configurada.
    if (result.length > this.config.maxInputLength) {
      result =
        result.slice(0, this.config.maxInputLength) +
        `\nExcedía el límite — cortado a ${this.config.maxInputLength} chars`;
    }

    return result;
  }

  /**
   * Detecta posibles intentos de prompt injection
   * comparando la entrada contra los patrones configurados.
   *
   * @param input Texto que se desea analizar.
   * @returns Resultado de la detección e identificador del patrón encontrado.
   */
  detectPromptInjection(input: string): {
    detected: boolean;
    pattern?: string;
  } {
    // Evaluar la entrada contra cada patrón de prompt injection.
    for (const { name, regex } of INJECTION_PATTERNS) {
      if (regex.test(input)) {
        return {
          detected: true,
          pattern: name,
        };
      }
    }

    return {
      detected: false,
    };
  }

  /**
   * Verifica si una nueva solicitud puede ser procesada.
   *
   * Elimina primero las solicitudes expiradas y posteriormente
   * valida si todavía existe capacidad dentro de la ventana.
   *
   * @returns `true` si la solicitud puede continuar.
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Eliminar solicitudes fuera de la ventana activa.
    this.removeExpiredRequests(now);

    // Rechazar cuando se alcanzó el máximo permitido.
    if (this.requestTimestamps.length >= this.config.rateLimit.maxRequest) {
      return false;
    }

    // Registrar la nueva solicitud.
    this.requestTimestamps.push(now);

    return true;
  }

  /**
   * Elimina las solicitudes que se encuentran
   * fuera de la ventana de tiempo configurada.
   *
   * @param now Instante actual en milisegundos.
   * @returns No retorna ningún valor.
   */
  private removeExpiredRequests(now: number): void {
    const windowStart = now - this.config.rateLimit.windowMs;

    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > windowStart,
    );
  }

  /**
   * Obtiene la cantidad de solicitudes disponibles
   * dentro de la ventana actual.
   */
  get remaining(): number {
    this.removeExpiredRequests(Date.now());

    return Math.max(
      0,
      this.config.rateLimit.maxRequest - this.requestTimestamps.length,
    );
  }

  /**
   * Obtiene la duración de la ventana configurada
   * expresada en segundos.
   */
  get window(): number {
    return Math.ceil(this.config.rateLimit.windowMs / 1000);
  }

  /**
   * Reinicia únicamente el estado del rate limiter.
   */
  resetRateLimit(): void {
    this.requestTimestamps = [];
  }

  // Helper para imprimir resultados con formato claro.
  printResult(
    title: string,
    input: string,
    result: {
      safe?: boolean;
      detected?: boolean;
      sanitized?: string;
      reason?: string;
      pattern?: string;
    },
  ): void {
    const icono =
      result.safe === false || result.detected === true
        ? "⚠️  BLOQUEADO"
        : "✅ SEGURO";

    console.log(`\n--- ${title} ---`);
    console.log(
      `Input: "${input.slice(0, 80)}${input.length > 80 ? "..." : ""}"`,
    );
    console.log(`Resultado: ${icono}`);

    if (result.reason) console.log(`Razón: ${result.reason}`);
    if (result.pattern) console.log(`Patrón: ${result.pattern}`);

    if (result.sanitized && result.sanitized !== input) {
      console.log(
        `Sanitizado: "${result.sanitized.slice(0, 80)}${
          result.sanitized.length > 80 ? "..." : ""
        }"`,
      );
    }
  }
}
