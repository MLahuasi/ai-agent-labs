import sys
import time
from pathlib import Path
from typing import Any

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.shared.types import ChatMessage
from ollama import ChatResponse, Client

from config.ollama.config import (
    OLLAMA_CHAT_OPTIONS,
    RETRYABLE_STATUS_CODES,
    load_ollama_host,
)


def create_ollama_client() -> Client:
    return Client(host=load_ollama_host())


def build_ollama_history(messages: list[ChatMessage]) -> list[dict[str, str]]:
    history: list[dict[str, str]] = []

    for message in messages:
        role = "user" if message["role"] == "user" else "assistant"
        history.append(
            {
                "role": role,
                "content": message["content"],
            }
        )

    return history


def send_chat_message_with_retry(
    client: Client,
    model: str,
    history: list[ChatMessage],
    question: str,
    max_retries: int = 3,
) -> ChatResponse:
    messages = build_ollama_history(history)
    messages.append({"role": "user", "content": question})

    for attempt in range(1, max_retries + 1):
        try:
            # The ollama SDK exposes overloads that Pyright cannot fully resolve here.
            chat_fn: Any = client.chat  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType]
            return chat_fn(
                model=model,
                messages=messages,
                stream=False,
                options=OLLAMA_CHAT_OPTIONS,
            )
        except Exception as error:
            status_code = getattr(error, "status_code", None)

            if status_code not in RETRYABLE_STATUS_CODES:
                raise

            if attempt == max_retries:
                raise RuntimeError(
                    f"Ollama no respondio despues de {max_retries} intentos. "
                    f"Ultimo error: {status_code}"
                ) from error

            wait_seconds = 2 ** attempt
            print(
                f"Ollama ocupado o con error temporal [{status_code}]. "
                f"Reintentando en {wait_seconds}s..."
            )
            time.sleep(wait_seconds)

    raise RuntimeError("No se pudo completar la consulta a Ollama.")


def get_response_text(response: ChatResponse) -> str:
    message = getattr(response, "message", None)

    if message is None:
        raise ValueError("Ollama no devolvio un mensaje de respuesta.")

    text = getattr(message, "content", None)

    if text is None:
        raise ValueError("Ollama no devolvio contenido de texto.")

    text = text.strip()

    if not text:
        raise ValueError("Ollama devolvio una respuesta vacia.")

    return text


def ask_chat_question(
    client: Client,
    model: str,
    messages: list[ChatMessage],
    role: str,
    question: str,
) -> str:
    response = send_chat_message_with_retry(
        client=client,
        model=model,
        history=messages,
        question=question,
    )

    answer = get_response_text(response)

    messages.append({"role": role, "content": question})
    messages.append({"role": "assistant", "model": model, "content": answer})

    return answer
