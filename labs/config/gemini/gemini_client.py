import time
import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from google import genai


from config.shared.types import ChatMessage
from google.genai import Client, types
from config.gemini.config import load_gemini_api_key, GEMINI_GENERATION_CONFIG, RETRYABLE_STATUS_CODES


def create_gemini_client():
    load_gemini_api_key()
    return genai.Client()


def build_gemini_history(messages: list[ChatMessage]) -> list[types.ContentOrDict]:
    history: list[types.ContentOrDict] = []

    for message in messages:
        role = "user" if message["role"] == "user" else "model"
        history.append(
            types.Content(
                role=role,
                parts=[types.Part(text=message["content"])],
            )
        )

    return history


def send_chat_message_with_retry(
    client: Client,
    model: str,
    history: list[ChatMessage],
    question: str,
    max_retries: int = 3,
) -> types.GenerateContentResponse:
    for attempt in range(1, max_retries + 1):
        try:
            chat = client.chats.create(
                model=model,
                config=GEMINI_GENERATION_CONFIG,
                history=build_gemini_history(history),
            )
            return chat.send_message(question)  # pyright: ignore[reportUnknownMemberType]

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


def get_response_text(response: types.GenerateContentResponse) -> str:

    text = getattr(response, "text", None)

    if text is None:
        raise ValueError("Gemini no devolvio contenido de texto.")

    text = text.strip()

    if not text:
        raise ValueError("Gemini devolvio una respuesta vacia.")

    return text

def ask_chat_question(
    client: Client,
    model: str,
    messages: list[ChatMessage],
    role: str,
    question: str,
) -> str:

    # print(question)

    response = send_chat_message_with_retry(
        client=client,
        model=model,
        history=messages,
        question=question,
    )

    answer = get_response_text(response)

    # print(answer)
    messages.append({"role": role, "content": question})
    messages.append({"role": "assistant", "model": model, "content": answer})

    return answer