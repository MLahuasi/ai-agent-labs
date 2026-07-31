import { Message, ToolDefinition } from "../types/agent/index.js";
import { AskFunction, CHAR_PER_TOKEN } from "./index.js";

/**
 * Gestiona una conversacion con un LLM.
 *
 * Mantiene el historial completo de mensajes
 * y lo envia en cada interaccion para conservar
 * el contexto de la conversacion.
 */
export class Conversation {
  /**
   * Historial completo de la conversacion.
   */
  private messages: Message[] = [];

  /**
   * Prompt de sistema utilizado durante toda
   * la conversacion.
   */
  private readonly systemPrompt: string;

  /**
   * Funcion responsable de comunicarse con el LLM.
   */
  private askFn: AskFunction | null = null;

  /**
   * Total aproximado de tokens enviados al modelo.
   */
  private totalInputTokens = 0;

  /**
   * Total aproximado de tokens generados por el modelo.
   */
  private totalOutputTokens = 0;

  constructor(systemPrompt: string = "") {
    this.systemPrompt = systemPrompt;
  }

  /**
   * Agrega un mensaje del usuario al historial.
   */
  addUserMessage(text: string): void {
    this.messages.push({
      role: "user",
      content: text,
    });

    // this.totalInputsTokens += Math.ceil(text.length / CHAR_PER_TOKEN);
  }

  /**
   * Agrega un mensaje generado por el asistente
   * al historial.
   */
  addAssistantMessage(text: string): void {
    this.messages.push({
      role: "assistant",
      content: text,
    });
  }

  /**
   * Envía todo el historial al modelo y almacena
   * automaticamente la respuesta obtenida.
   *
   * @returns Respuesta generada por el LLM.
   */
  async send(prompt: string, tools?: ToolDefinition[]): Promise<string> {
    if (!this.askFn) {
      throw new Error("No se ha configurado un cliente LLM");
    }

    this.addUserMessage(prompt);

    const response = await this.askFn({
      prompt,
      systemPrompt: this.systemPrompt,
      messages: this.messages,
      tools,
    });

    this.addAssistantMessage(response.text);

    this.addUsage(response.totalInputTokens, response.totalOutputTokens);

    return response.text;
  }

  async sendChat(
    prompt: string,
    tools?: ToolDefinition[],
    messages?: Message[],
  ): Promise<{
    text: string;
    messages: Message[];
  }> {
    if (!this.askFn) {
      throw new Error("No se ha configurado un cliente LLM");
    }

    if (messages) {
      this.messages = messages;
    }

    this.addUserMessage(prompt);

    const { text, totalInputTokens, totalOutputTokens, conversation } =
      await this.askFn({
        prompt,
        systemPrompt: this.systemPrompt,
        messages: this.messages,
        tools,
      });

    if (conversation) {
      this.messages = conversation;
    } else this.addAssistantMessage(text);

    this.addUsage(totalInputTokens, totalOutputTokens);

    return {
      text,
      messages: this.messages,
    };
  }

  addUsage(input_tokens: number, output_tokens: number) {
    this.totalInputTokens += input_tokens;
    this.totalOutputTokens += output_tokens;
  }

  /**
   * Reinicia completamente el estado de la conversación.
   *
   * Acciones realizadas:
   * - Elimina todo el historial de mensajes.
   * - Reinicia el contador de tokens de entrada.
   * - Reinicia el contador de tokens de salida.
   *
   * Es útil cuando se desea comenzar una nueva
   * conversación sin conservar contexto previo.
   */
  clear(): void {
    this.messages = [];
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    console.log(" Conversación reiniciada.");
  }

  /**
   * Devuelve el número de turnos de la conversación.
   *
   * Se considera un turno como:
   * Usuario -> Asistente
   *
   * Como cada interacción normalmente genera
   * dos mensajes (uno del usuario y otro del asistente),
   * se divide el tamaño total del historial entre 2.
   *
   * Ejemplo:
   * [
   *   user: "Hola",
   *   assistant: "Hola, ¿en qué puedo ayudarte?",
   *   user: "¿Qué hora es?",
   *   assistant: "Son las 10:00"
   * ]
   *
   * Total mensajes = 4
   * Turnos = 4 / 2 = 2
   *
   * Math.floor se utiliza para evitar decimales
   * en caso de que exista un mensaje sin respuesta.
   */
  getTurnCount(): number {
    return Math.floor(this.messages.length / 2);
  }

  /**
   * Estima aproximadamente cuántos tokens ocupa
   * el historial actual de la conversación.
   *
   * Esta estimación NO es exacta porque cada modelo
   * tokeniza el texto de forma distinta.
   *
   * Regla usada:
   * 1 token ≈ 4 caracteres.
   */
  estimateCurrentTokens(): number {
    /**
     * Recorre todos los mensajes del historial
     * y suma la longitud del contenido de cada uno.
     *
     * Ejemplo:
     *
     * [
     *   { content: "Hola" },        // 4 chars
     *   { content: "¿Qué tal?" }    // 9 chars
     * ]
     *
     * Resultado:
     * totalChars = 13
     */
    const totalChars = this.messages.reduce(
      /**
       * sum = acumulador donde se guarda la suma
       * de caracteres obtenida hasta el momento.
       *
       * msg = mensaje actual que está recorriendo.
       *
       * msg.content.length devuelve la cantidad
       * de caracteres del mensaje actual.
       */
      (sum, msg) => sum + msg.content.length,

      /**
       * Valor inicial del acumulador.
       */
      0,
    );

    /**
     * Convierte caracteres a tokens aproximados.
     *
     * Ejemplo:
     * 200 caracteres / 4 = 50 tokens
     *
     * Math.floor elimina los decimales.
     */
    return Math.floor(totalChars / CHAR_PER_TOKEN);
  }

  /**
   * Devuelve estadísticas acumuladas de la conversación.
   *
   * Información incluida:
   * - inputTokens: cantidad total de tokens enviados al LLM.
   * - outputTokens: cantidad total de tokens generados por el LLM.
   * - turns: número de turnos de conversación registrados.
   *
   * Estas métricas son útiles para:
   * - Monitorear el consumo de tokens.
   * - Estimar costos de uso de la API.
   * - Analizar la longitud y actividad de la conversación.
   *
   * Ejemplo de resultado:
   * {
   *   inputTokens: 1250,
   *   outputTokens: 320,
   *   turns: 5
   * }
   */
  getStats(): {
    inputTokens: number;
    outputTokens: number;
    turns: number;
  } {
    return {
      // Total acumulado de tokens enviados al modelo.
      inputTokens: this.totalInputTokens,

      // Total acumulado de tokens generados por el modelo.
      outputTokens: this.totalOutputTokens,

      // Número de intercambios usuario-asistente.
      turns: this.getTurnCount(),
    };
  }
  /**
   * Devuelve una copia del historial.
   */
  getHistory(): Message[] {
    return [...this.messages];
  }

  setAsk(askFn: AskFunction) {
    this.askFn = askFn;
  }
}
