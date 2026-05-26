import time
import sys
from pathlib import Path
from typing import Any

from google.genai import types

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.gemini.config import RETRYABLE_STATUS_CODES


def ask_chat_question(chat: Any, question: str) -> str:
    print(question)

    response = send_chat_message_with_retry(chat, question)
    answer = get_gemini_response_text(response)

    print(answer)

    return answer


def send_chat_message_with_retry(
    chat: Any,
    message: str,
    max_retries: int = 3,
) -> types.GenerateContentResponse:
    for attempt in range(1, max_retries + 1):
        try:
            return chat.send_message(message)

        except Exception as error:
            status_code = getattr(error, "code", None)

            if status_code not in RETRYABLE_STATUS_CODES:
                raise

            if attempt == max_retries:
                raise RuntimeError(
                    f"Gemini no respondio despues de {max_retries} intentos. "
                    f"Ultimo error: {status_code}"
                ) from error

            wait_seconds = 2 ** attempt
            print(
                f"Gemini ocupado o con error temporal [{status_code}]. "
                f"Reintentando en {wait_seconds}s..."
            )
            time.sleep(wait_seconds)

    raise RuntimeError("No se pudo completar la consulta a Gemini.")


def get_gemini_response_text(response) -> str:
    if response is None:
        raise ValueError("Gemini devolvio una respuesta nula.")

    text = getattr(response, "text", None)

    if text is None:
        raise ValueError("Gemini no devolvio contenido de texto.")

    text = text.strip()

    if not text:
        raise ValueError("Gemini devolvio una respuesta vacia.")

    return text
