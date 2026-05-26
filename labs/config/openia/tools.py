import time
import sys
from pathlib import Path
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam
from config.openia.config import RETRYABLE_STATUS_CODES
LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

def send_chat_completion_with_retry(
    client: OpenAI,
    model: str,
    messages: list[ChatCompletionMessageParam],
    max_retries: int = 3,
):
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
                    f"OpenAI no respondio despues de {max_retries} intentos. "
                    f"Ultimo error: {status_code}"
                ) from error

            wait_seconds = 2 ** attempt
            print(
                f"OpenAI ocupado o con error temporal [{status_code}]. "
                f"Reintentando en {wait_seconds}s..."
            )
            time.sleep(wait_seconds)

    raise RuntimeError("No se pudo completar la consulta a OpenAI.")


def get_chat_completion_text(response) -> str:
    if response is None:
        raise ValueError("OpenAI devolvio una respuesta nula.")

    if not response.choices:
        raise ValueError("OpenAI no devolvio opciones de respuesta.")

    text = response.choices[0].message.content

    if text is None:
        raise ValueError("OpenAI no devolvio contenido de texto.")

    text = text.strip()

    if not text:
        raise ValueError("OpenAI devolvio una respuesta vacia.")

    return text


def ask_chat_completion_question(
    client: OpenAI,
    model: str,
    messages: list[ChatCompletionMessageParam],
    question: str,
) -> str:
    messages.append({"role": "user", "content": question})

    def send_message(prompt: str):
        return send_chat_completion_with_retry(
            client=client,
            model=model,
            messages=messages,
        )

    print(question)

    response = send_message(question)
    answer = get_chat_completion_text(response)

    print(answer)

    messages.append({"role": "assistant", "content": answer})

    return answer