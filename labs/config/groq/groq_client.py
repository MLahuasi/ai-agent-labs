import time
import sys
from pathlib import Path
from typing import cast

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.shared.types import ChatMessage

from openai import OpenAI

from config.groq.config import GROQ_BASE_URL, RETRYABLE_STATUS_CODES, load_groq_api_key
from openai.types.chat import (
    ChatCompletion,
    ChatCompletionMessageParam,
)


def create_groq_client() -> OpenAI:
    return OpenAI(
        api_key=load_groq_api_key(),
        base_url=GROQ_BASE_URL,
    )

def build_groq_history(
    messages: list[ChatMessage],
) -> list[ChatCompletionMessageParam]:
    history: list[ChatCompletionMessageParam] = []

    for message in messages:
        role = message["role"].lower()

        if role in {"model", "ia"}:
            role = "assistant"

        if role not in {
            "developer",
            "system",
            "user",
            "assistant",
            "tool",
            "function",
        }:
            role = "user"

        history.append(
            cast(
                ChatCompletionMessageParam,
                {
                    "role": role,
                    "content": message["content"],
                },
            )
        )

    return history


def send_chat_message_with_retry(
    client: OpenAI,
    model: str,
    history: list[ChatMessage],
    question: str,
    max_retries: int = 3,
) -> ChatCompletion:
    messages = build_groq_history(history)
    messages.append(
        cast(
            ChatCompletionMessageParam,
            {
                "role": "user",
                "content": question,
            },
        )
    )

    for attempt in range(1, max_retries + 1):
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages,
            )

        except Exception as error:
            status_code = getattr(error, "status_code", None)

            if status_code not in RETRYABLE_STATUS_CODES:
                raise

            if attempt == max_retries:
                raise RuntimeError(
                    f"Groq no respondio despues de {max_retries} intentos. "
                    f"Ultimo error: {status_code}"
                ) from error

            wait_seconds = 2 ** attempt
            print(
                f"Groq ocupado o con error temporal [{status_code}]. "
                f"Reintentando en {wait_seconds}s..."
            )
            time.sleep(wait_seconds)

    raise RuntimeError("No se pudo completar la consulta a Groq.")


def get_response_text(response: ChatCompletion) -> str:
    if not response.choices:
        raise ValueError("Groq no devolvio opciones de respuesta.")

    text = response.choices[0].message.content

    if text is None:
        raise ValueError("Groq no devolvio contenido de texto.")

    text = text.strip()

    if not text:
        raise ValueError("Groq devolvio una respuesta vacia.")

    return text


def ask_chat_question(
    client: OpenAI,
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
