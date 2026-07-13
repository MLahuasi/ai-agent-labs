# Coordinar indexación y recuperación

from __future__ import annotations

import hashlib
import json

from pathlib import Path

from config.shared.llm_client import LlmClientAdapter

from rag.documents import (
    load_knowledge_documents,
    split_documents,
)
from rag.vector_store import JsonVectorStore


class RagRetriever:
    """
    Inicializa el índice y recupera contexto relevante.

    Depende del contrato LlmClientAdapter y no de un proveedor
    o SDK concreto.
    """

    def __init__(
        self,
        *,
        llm_adapter: LlmClientAdapter,
        client: object,
        data_dir: Path,
        embedding_model: str,
    ) -> None:
        documents = load_knowledge_documents(
            data_dir
        )

        fingerprint = self._build_fingerprint(
            documents
        )

        self._vector_store = JsonVectorStore(
            llm_adapter=llm_adapter,
            client=client,
            index_file=(
                data_dir
                / ".rag"
                / "index-openai.json"
            ),
            embedding_model=embedding_model,
        )

        index_loaded = self._vector_store.load(
            expected_fingerprint=fingerprint
        )

        if index_loaded:
            print("Índice RAG cargado.")

            return

        print("Construyendo índice RAG...")

        chunks = split_documents(
            documents
        )

        self._vector_store.build(
            chunks=chunks,
            fingerprint=fingerprint,
        )

        print(
            f"Índice RAG creado con "
            f"{len(chunks)} fragmentos."
        )

    def retrieve(
        self,
        query: str,
    ) -> str:
        """
        Recupera contexto relevante y lo prepara
        para incorporarlo al system prompt.
        """

        entries = self._vector_store.search(
            query
        )

        if not entries:
            return (
                "No se recuperó información relevante "
                "para esta consulta."
            )

        context_blocks = [
            (
                f"Fuente: {entry['source']}\n"
                f"Contenido:\n"
                f"{entry['content']}"
            )
            for entry in entries
        ]

        return "\n\n---\n\n".join(
            context_blocks
        )

    @staticmethod
    def _build_fingerprint(
        documents: dict[str, str],
    ) -> str:
        """
        Calcula una huella basada en el contenido.

        El índice se reconstruirá cuando cambie
        cualquiera de las fuentes.
        """

        serialized_documents = json.dumps(
            documents,
            ensure_ascii=False,
            sort_keys=True,
        )

        return hashlib.sha256(
            serialized_documents.encode(
                "utf-8"
            )
        ).hexdigest()