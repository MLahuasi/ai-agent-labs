import sys
import time
from pathlib import Path

from ollama import Client

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.ollama.config import OLLAMA_CHAT_OPTIONS, RETRYABLE_STATUS_CODES


def send_chat_message_with_retry(
    client: Client,
    model: str,
    messages: list[dict[str, str]],
    max_retries: int = 3,
):
    for attempt in range(1, max_retries + 1):
        try:
            return client.chat(
                model=model,
                messages=messages,
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


def get_ollama_response_text(response) -> str:
    if response is None:
        raise ValueError("Ollama devolvio una respuesta nula.")

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
    messages: list[dict[str, str]],
    question: str,
) -> str:
    messages.append({"role": "user", "content": question})

    print(question)

    response = send_chat_message_with_retry(
        client=client,
        model=model,
        messages=messages,
    )
    answer = get_ollama_response_text(response)

    print(answer)

    messages.append({"role": "assistant", "content": answer})

    return answer
