import { RetrievedChunk } from "../../types/rag/index.js";
import { retrieveContext } from "../store/retriever.js";

/**
 * Servicio encargado de construir prompts utilizando contexto recuperado.
 */
export class RagPromptService {
  /**
   * Construye un prompt RAG utilizando los fragmentos relevantes
   * recuperados para la consulta.
   *
   * @param prompt Consulta utilizada para recuperar el contexto.
   * @param rag_instructions Instrucciones que debe seguir el modelo al responder.
   * @return Prompt construido con el contexto recuperado.
   */
  async buildRagPrompt(
    prompt: string,
    rag_instructions: string,
  ): Promise<string> {
    const chunks = await retrieveContext(prompt);

    // Informa cuando la documentación todavía no ha sido indexada.
    if (chunks.length === 0) {
      return (
        "No hay documentación indexada disponible para realizar la consulta.\n" +
        "Ejecuta el comando /ingest para indexar la documentación antes de usar RAG."
      );
    }

    // Registra las fuentes utilizadas para construir el contexto.
    this.logRetrievedSources(chunks);

    // Formatea los fragmentos recuperados antes de construir el prompt.
    const formattedContext = this.formatContext(chunks);

    return this.buildRagPromptTemplate(
      prompt,
      formattedContext,
      rag_instructions,
    );
  }

  /**
   * Construye el prompt utilizando el contexto y las instrucciones RAG.
   *
   * @param question Pregunta realizada por el usuario.
   * @param context Contexto recuperado y formateado.
   * @param rag_instructions Instrucciones que debe seguir el modelo al responder.
   * @return Prompt RAG construido.
   */
  private buildRagPromptTemplate(
    question: string,
    context: string,
    rag_instructions: string,
  ): string {
    return `Contexto recuperado de la documentación:
---
${context}
---
${rag_instructions}

Pregunta: ${question}`;
  }

  /**
   * Formatea los fragmentos recuperados incluyendo su fuente y sección.
   *
   * @param chunks Fragmentos recuperados para la consulta.
   * @return Contexto formateado.
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
   * Registra las fuentes únicas utilizadas para construir el contexto.
   *
   * @param chunks Fragmentos recuperados para la consulta.
   * @return No retorna ningún valor.
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
