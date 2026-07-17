# Generar embeddings, persistir el índice y buscar por similitud

from __future__ import annotations

import json
import math

from pathlib import Path
from typing import TypedDict

from config.shared.llm_client import LlmClientAdapter

from rag.documents import DocumentChunk


class VectorEntry(TypedDict):
    """Fragmento persistido junto con su representación vectorial."""

    source: str
    content: str
    embedding: list[float]


class VectorIndex(TypedDict):
    """Estructura del índice RAG almacenado localmente."""

    fingerprint: str
    embedding_model: str
    entries: list[VectorEntry]


class JsonVectorStore:
    """
    Almacén vectorial local basado en JSON.

    Esta clase administra persistencia y búsqueda vectorial.
    No conoce OpenAI ni ningún SDK específico.
    """

    def __init__(
        self,
        *,
        llm_adapter: LlmClientAdapter,
        # Instancia del cliente creada en el punto de composición.
        # Se reutiliza para generar embeddings sin crear una nueva
        # conexión ni acoplar el vector store a un proveedor específico.
        client: object,
        index_file: Path,
        embedding_model: str,
    ) -> None:
        # El adapter encapsula las operaciones específicas
        # del proveedor utilizado.
        self._llm_adapter = llm_adapter

        # El cliente se mantiene opaco para el vector store.
        self._client = client

        self._index_file = index_file

        self._embedding_model = embedding_model

        self._entries: list[VectorEntry] = []

    def load(
        self,
        expected_fingerprint: str,
    ) -> bool:
        """
        Carga el índice existente.

        Retorna False cuando el índice no existe, las fuentes
        cambiaron o se modificó el modelo de embeddings.
        """

        if not self._index_file.exists():
            return False

        with self._index_file.open(
            "r",
            encoding="utf-8",
        ) as file:
            index: VectorIndex = json.load(file)

        if index["fingerprint"] != expected_fingerprint:
            return False

        if index["embedding_model"] != self._embedding_model:
            return False

        self._entries = index["entries"]

        return True

    def build(
        self,
        *,
        chunks: list[DocumentChunk],
        fingerprint: str,
    ) -> None:
        """
        Genera los embeddings y persiste el índice.

        El vector store delega la generación al adapter,
        por lo que no depende de un proveedor específico.
        """

        if not chunks:
            raise ValueError(
                "No existen fragmentos para construir el índice RAG."
            )

        embeddings = self._llm_adapter.create_embeddings(
            client=self._client,
            model=self._embedding_model,
            texts=[
                chunk["content"]
                for chunk in chunks
            ],
        )

        if len(embeddings) != len(chunks):
            raise RuntimeError(
                "La cantidad de embeddings no coincide "
                "con la cantidad de fragmentos."
            )

        self._entries = [
            {
                "source": chunk["source"],
                "content": chunk["content"],
                "embedding": embedding,
            }
            for chunk, embedding in zip(
                chunks,
                embeddings,
                strict=True,
            )
        ]

        self._save(fingerprint)

    def search(
        self,
        query: str,
        *,
        top_k: int = 4,
        minimum_score: float = 0.20,
    ) -> list[VectorEntry]:
        """
        Recupera los fragmentos más similares a la consulta.

        La consulta se transforma en embedding mediante el adapter.
        """

        if not self._entries:
            raise RuntimeError(
                "El índice RAG no está inicializado."
            )

        embeddings = self._llm_adapter.create_embeddings(
            client=self._client,
            model=self._embedding_model,
            texts=[query],
        )

        if not embeddings:
            raise RuntimeError(
                "No se pudo generar el embedding de la consulta."
            )

        query_embedding = embeddings[0]

        ranked_entries = sorted(
            (
                (
                    self._cosine_similarity(
                        query_embedding,
                        entry["embedding"],
                    ),
                    entry,
                )
                for entry in self._entries
            ),
            key=lambda result: result[0],
            reverse=True,
        )

        return [
            entry
            for score, entry in ranked_entries[:top_k]
            if score >= minimum_score
        ]

    def _save(
        self,
        fingerprint: str,
    ) -> None:
        """Persiste el índice para reutilizarlo entre ejecuciones."""

        self._index_file.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        index: VectorIndex = {
            "fingerprint": fingerprint,
            "embedding_model": self._embedding_model,
            "entries": self._entries,
        }

        with self._index_file.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                index,
                file,
                ensure_ascii=False,
            )

    @staticmethod
    def _cosine_similarity(
        first: list[float],
        second: list[float],
    ) -> float:
        """
        Calcula similitud coseno usando la librería estándar.

        No se agrega NumPy porque el volumen del laboratorio
        es pequeño y no justifica una dependencia adicional.
        """

        if len(first) != len(second):
            raise ValueError(
                "Los vectores deben tener la misma dimensión."
            )

        dot_product = sum(
            first_value * second_value
            for first_value, second_value in zip(
                first,
                second,
                strict=True,
            )
        )

        first_norm = math.sqrt(
            sum(
                value * value
                for value in first
            )
        )

        second_norm = math.sqrt(
            sum(
                value * value
                for value in second
            )
        )

        if first_norm == 0 or second_norm == 0:
            return 0.0

        return dot_product / (
            first_norm * second_norm
        )