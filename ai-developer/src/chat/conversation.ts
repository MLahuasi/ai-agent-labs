import {
  Message,
  ToolDefinition,
  ToolExecutionHandler,
  ToolExecutionState,
} from "../types/agent/index.js";
import { AskFunction, CHAR_PER_TOKEN } from "./index.js";

/**
 * Configuración utilizada para controlar la ejecución de una conversación.
 */
export interface ConversationOptions {
  /**
   * Máximo de tokens permitidos en respuestas sin herramientas.
   */
  maxTokens: number;

  /**
   * Máximo de tokens permitidos en respuestas con herramientas.
   */
  maxTokensTools: number;

  /**
   * Máximo de iteraciones permitidas durante un turno.
   */
  maxIterations: number;

  /**
   * Máximo de llamadas a herramientas permitidas durante un turno.
   */
  maxToolCalls: number;
}

/**
 * Gestiona una conversación con un modelo LLM.
 */
export class Conversation {
  /**
   * Historial de mensajes de la conversación.
   */
  private messages: Message[] = [];

  /**
   * Prompt de sistema utilizado durante la conversación.
   */
  private readonly systemPrompt: string;

  /**
   * Función utilizada para comunicarse con el modelo.
   */
  private askFn: AskFunction | null = null;

  /**
   * Total acumulado de tokens enviados al modelo.
   */
  private totalInputTokens = 0;

  /**
   * Total acumulado de tokens generados por el modelo.
   */
  private totalOutputTokens = 0;

  /**
   * Cantidad de llamadas a herramientas realizadas durante el último turno.
   */
  private toolCallsLastTurn = 0;

  /**
   * Configuración utilizada para controlar la ejecución de la conversación.
   */
  private readonly options: ConversationOptions;

  /**
   * Herramientas utilizadas durante el último turno.
   */
  private toolsUsedLastTurn: string[] = [];

  /**
   * Crea una nueva conversación.
   *
   * @param systemPrompt Prompt de sistema utilizado por el modelo.
   * @param options Configuración utilizada durante la conversación.
   * @param options.maxTokens Máximo de tokens permitidos en respuestas sin herramientas.
   * @param options.maxTokensTools Máximo de tokens permitidos en respuestas con herramientas.
   * @param options.maxIterations Máximo de iteraciones permitidas durante un turno.
   * @param options.maxToolCalls Máximo de llamadas a herramientas permitidas por turno.
   */
  constructor(systemPrompt: string = "", options: ConversationOptions) {
    // Almacena el prompt de sistema.
    this.systemPrompt = systemPrompt;

    // Almacena la configuración de ejecución de la conversación.
    this.options = options;
  }

  /**
   * Agrega un mensaje del usuario al historial.
   *
   * @param text Contenido del mensaje.
   * @return No retorna ningún valor.
   */
  addUserMessage(text: string): void {
    // Agrega el mensaje al historial.
    this.messages.push({
      role: "user",
      content: text,
    });

    // this.totalInputsTokens += Math.ceil(text.length / CHAR_PER_TOKEN);
  }

  /**
   * Agrega un mensaje del asistente al historial.
   *
   * @param text Contenido del mensaje.
   * @return No retorna ningún valor.
   */
  addAssistantMessage(text: string): void {
    // Agrega el mensaje al historial.
    this.messages.push({
      role: "assistant",
      content: text,
    });
  }

  /**
   * Envía un mensaje al modelo y almacena la respuesta.
   *
   * @param prompt Mensaje enviado por el usuario.
   * @param tools Herramientas disponibles para el modelo.
   * @param executeTool Función que contiene las tools que se ejecutan
   * @return Texto generado por el modelo.
   */
  async send(
    prompt: string,
    tools?: ToolDefinition[],
    executeTool?: ToolExecutionHandler,
  ): Promise<string> {
    // Comprueba que exista un cliente LLM configurado.
    if (!this.askFn) {
      throw new Error("No se ha configurado un cliente LLM");
    }

    // Comprueba que exista un ejecutor cuando se proporcionan herramientas.
    if (tools?.length && !executeTool) {
      throw new Error(
        "Se proporcionaron tools pero no un ejecutor de herramientas.",
      );
    }
    // Agrega el mensaje del usuario al historial.
    this.addUserMessage(prompt);

    // Crea el estado únicamente para este turno.
    const toolState = this.createToolExecutionState();

    // Envía la conversación al modelo.
    const response = await this.askFn({
      prompt,
      systemPrompt: this.systemPrompt,
      messages: this.messages,
      tools,
      executeTool,
      toolState,
      maxIterations: this.options.maxIterations,
      maxTokens: this.options.maxTokens,
      maxTokensTools: this.options.maxTokensTools,
    });

    // Almacena la cantidad de herramientas utilizadas durante el último turno.
    this.toolCallsLastTurn = response.toolCallsLastTurn;

    // Almacena el nombre de las herramientas usadas en el último turno
    this.toolsUsedLastTurn = [...response.toolsUsed];

    // Agrega la respuesta del asistente al historial.
    this.addAssistantMessage(response.text);

    // Actualiza el consumo de tokens.
    this.addUsage(response.totalInputTokens, response.totalOutputTokens);

    // Retorna la respuesta del modelo.
    return response.text;
  }

  /**
   * Envía un mensaje al modelo y retorna el estado de la conversación.
   *
   * @param prompt Mensaje enviado por el usuario.
   * @param tools Herramientas disponibles para el modelo.
   * @param executeTool Función que contiene las tools que se ejecutan
   * @return Respuesta del modelo y mensajes de la conversación.
   */
  async sendChat(
    prompt: string,
    tools?: ToolDefinition[],
    executeTool?: ToolExecutionHandler,
  ): Promise<{
    text: string;
    messages: Message[];
  }> {
    // Comprueba que exista un cliente LLM configurado.
    if (!this.askFn) {
      throw new Error("No se ha configurado un cliente LLM");
    }

    // Comprueba que exista un ejecutor cuando se proporcionan herramientas.
    if (tools?.length && !executeTool) {
      throw new Error(
        "Se proporcionaron tools pero no un ejecutor de herramientas.",
      );
    }

    // Agrega el nuevo mensaje del usuario.
    this.addUserMessage(prompt);

    // Estado independiente para este nuevo turno.
    const toolState = this.createToolExecutionState();

    // Envía la conversación al modelo.
    const {
      text,
      totalInputTokens,
      totalOutputTokens,
      conversation,
      toolCallsLastTurn,
      toolsUsed,
    } = await this.askFn({
      prompt,
      systemPrompt: this.systemPrompt,
      messages: this.messages,
      tools,
      executeTool,
      toolState,
      maxIterations: this.options.maxIterations,
      maxTokens: this.options.maxTokens,
      maxTokensTools: this.options.maxTokensTools,
    });

    // Almacena la cantidad a herramientas durante el último turno.
    this.toolCallsLastTurn = toolCallsLastTurn;

    // Almacena los nombres de las herramientas durante el último turno
    this.toolsUsedLastTurn = [...toolsUsed];

    // Actualiza el historial con la conversación retornada.
    if (conversation) {
      this.messages = conversation;
    } else {
      // Agrega la respuesta cuando no se retorna una conversación completa.
      this.addAssistantMessage(text);
    }

    // Actualiza el consumo de tokens.
    this.addUsage(totalInputTokens, totalOutputTokens);

    // Retorna la respuesta y el historial actualizado.
    return {
      text,
      messages: this.messages,
    };
  }

  /**
   * Acumula el consumo de tokens de la conversación.
   *
   * @param input_tokens Tokens enviados al modelo.
   * @param output_tokens Tokens generados por el modelo.
   * @return No retorna ningún valor.
   */
  addUsage(input_tokens: number, output_tokens: number): void {
    // Acumula los tokens de entrada.
    this.totalInputTokens += input_tokens;

    // Acumula los tokens de salida.
    this.totalOutputTokens += output_tokens;
  }

  /**
   * Reinicia el estado de la conversación.
   *
   * @return No retorna ningún valor.
   */
  clear(): void {
    // Elimina el historial de mensajes.
    this.messages = [];

    // Reinicia los tokens de entrada.
    this.totalInputTokens = 0;

    // Reinicia los tokens de salida.
    this.totalOutputTokens = 0;

    // Reinicia las llamadas a herramientas registradas para el último turno.
    this.toolCallsLastTurn = 0;

    // Reinicia las herramientas utilizadas durante el último turno.
    this.toolsUsedLastTurn = [];

    console.log(" Conversación reiniciada.");
  }

  /**
   * Obtiene el número de turnos de la conversación.
   *
   * @return Cantidad de turnos registrados.
   */
  getTurnCount(): number {
    // Calcula los intercambios usuario-asistente.
    return Math.floor(this.messages.length / 2);
  }

  /**
   * Estima los tokens utilizados por el historial actual.
   *
   * @return Cantidad aproximada de tokens.
   */
  estimateCurrentTokens(): number {
    // Calcula la cantidad total de caracteres del historial.
    const totalChars = this.messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0,
    );

    // Convierte los caracteres a una cantidad aproximada de tokens.
    return Math.floor(totalChars / CHAR_PER_TOKEN);
  }

  /**
   * Obtiene estadísticas acumuladas de la conversación.
   *
   * @return Consumo de tokens, cantidad de turnos y llamadas a herramientas del último turno.
   */
  getStats(): {
    inputTokens: number;
    outputTokens: number;
    turns: number;
    toolCallsLastTurn: number;
  } {
    // Retorna las estadísticas actuales.
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      turns: this.getTurnCount(),
      toolCallsLastTurn: this.toolCallsLastTurn,
    };
  }

  /**
   * Obtiene una copia del historial de mensajes.
   *
   * @return Copia del historial de la conversación.
   */
  getHistory(): Message[] {
    // Retorna una copia para evitar modificar el historial directamente.
    return [...this.messages];
  }

  /**
   * Configura la función utilizada para comunicarse con el modelo.
   *
   * @param askFn Función que ejecuta las solicitudes al LLM.
   * @return No retorna ningún valor.
   */
  setAsk(askFn: AskFunction): void {
    // Configura el cliente utilizado por la conversación.
    this.askFn = askFn;
  }

  /**
   * Reemplaza el historial actual de la conversación.
   *
   * @param messages Mensajes utilizados como nuevo historial.
   * @return No retorna ningún valor.
   */
  setHistory(messages: Message[]): void {
    this.messages = [...messages];
  }

  /**
   * Obtiene las herramientas utilizadas durante el último turno.
   *
   * @return Nombres de las herramientas utilizadas.
   */
  getToolsUsedLastTurn(): string[] {
    return [...this.toolsUsedLastTurn];
  }

  /**
   * Crea el estado de ejecución de herramientas para un nuevo turno.
   *
   * Inicializa el seguimiento de herramientas, llamadas ejecutadas
   * y límite máximo de llamadas permitido.
   *
   * @return Estado inicial de ejecución de herramientas.
   */
  private createToolExecutionState(): ToolExecutionState {
    return {
      toolsUsed: new Set<string>(),
      executedToolCalls: new Set<string>(),
      toolCallsLastTurn: 0,
      maxToolCalls: this.options.maxToolCalls,
    };
  }
}
