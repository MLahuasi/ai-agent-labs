# Leer las fuentes autorizadas y dividirlas en fragmentos
from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from config.shared.read import read_json_file, read_pdf, read_text_file


class DocumentChunk(TypedDict):
    """Fragmento de una fuente que será convertido en embedding."""

    source: str
    content: str


# Se declaran explícitamente las fuentes autorizadas.
# Esto evita indexar archivos de historial u otros JSON generados en data/.
KNOWLEDGE_FILES = (
    "summary.txt",
    "cv_2026.pdf",
    "github-projects-knowledge.json",
)


def load_knowledge_documents(data_dir: Path) -> dict[str, str]:
    """Carga únicamente los archivos definidos como fuente de verdad."""

    readers = {
        ".txt": read_text_file,
        ".pdf": read_pdf,
        ".json": read_json_file,
    }

    documents: dict[str, str] = {}

    for file_name in KNOWLEDGE_FILES:
        file_path = data_dir / file_name

        if not file_path.exists():
            raise FileNotFoundError(
                f"No se encontró la fuente RAG requerida: {file_path}"
            )

        reader = readers[file_path.suffix]
        documents[file_name] = reader(file_path)

    return documents


def split_documents(
    documents: dict[str, str],
    *,
    chunk_size: int = 1_200,
    overlap: int = 200,
) -> list[DocumentChunk]:
    """
    Divide las fuentes en fragmentos pequeños con solapamiento.

    El solapamiento conserva contexto cuando una idea queda dividida
    entre dos fragmentos.
    """

    if overlap >= chunk_size:
        raise ValueError("overlap debe ser menor que chunk_size.")

    chunks: list[DocumentChunk] = []

    for source, content in documents.items():
        normalized_content = " ".join(content.split())

        start = 0

        while start < len(normalized_content):
            end = min(start + chunk_size, len(normalized_content))

            # Cuando sea posible, termina el fragmento en un espacio.
            if end < len(normalized_content):
                last_space = normalized_content.rfind(" ", start, end)

                if last_space > start:
                    end = last_space

            chunk_content = normalized_content[start:end].strip()

            if chunk_content:
                chunks.append(
                    {
                        "source": source,
                        "content": chunk_content,
                    }
                )

            if end >= len(normalized_content):
                break

            start = max(end - overlap, start + 1)

    return chunks