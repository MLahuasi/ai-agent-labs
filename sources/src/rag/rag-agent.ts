import { AgentRequest, AgentResponse } from "../types/agent/index.js";
import { LlmClient } from "../types/app/index.js";
import { RetrievedChunk } from "../types/rag/index.js";
import { retrieveContext } from "./retriever.js";

export class RagAgent {
  constructor(private readonly llm: LlmClient) {}

  /**
   * Responde una pregunta utilizando el contexto recuperado
   * desde la documentación indexada.
   */
  async askWithRAG({
    prompt,
    messages,
    systemPrompt,
  }: AgentRequest): Promise<AgentResponse> {
    const chunks = await retrieveContext(prompt);

    // Evita consultar al modelo si no existe documentación disponible.
    if (chunks.length === 0) {
      const message =
        "No hay documentación disponible en el vector store.\n" +
        "Usa el comando: /ingest";

      return {
        text: message,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolsUsed: [],
        conversation: messages,
      };
    }

    this.logRetrievedSources(chunks);

    const formattedContext = this.formatContext(chunks);
    const augmentedPrompt = this.createAugmentedPrompt(
      prompt,
      formattedContext,
    );

    return this.llm.stream({
      prompt: augmentedPrompt,
      systemPrompt,
    });
  }

  /**
   * Formatea los fragmentos recuperados incluyendo
   * su archivo de origen y sección.
   */
  private formatContext(chunks: RetrievedChunk[]): string {
    return chunks
      .map(
        (chunk) =>
          `[FUENTE: ${chunk.metadata.source} | Sección: ${chunk.metadata.heading}]\n${chunk.content}`,
      )
      .join("\n\n---\n\n");
  }

  /**
   * Construye el prompt con el contexto y la pregunta del usuario.
   */
  private createAugmentedPrompt(
    question: string,
    formattedContext: string,
  ): string {
    return `Contexto recuperado de la documentación:
---
${formattedContext}
---
Basándote ÚNICAMENTE en el contexto anterior, responde la siguiente pregunta.
Si la información no está en el contexto, indica claramente que no tienes esa información.
Cita la fuente (nombre del archivo y sección) cuando sea posible.

Pregunta: ${question}`;
  }

  /**
   * Registra las fuentes únicas recuperadas como contexto.
   */
  private logRetrievedSources(chunks: RetrievedChunk[]): void {
    const sources = new Set(
      chunks.map(
        (chunk) => `${chunk.metadata.source} (${chunk.metadata.heading})`,
      ),
    );

    console.log("\nContexto recuperado de:");

    for (const source of sources) {
      console.log(`-> ${source}`);
    }
  }
}
