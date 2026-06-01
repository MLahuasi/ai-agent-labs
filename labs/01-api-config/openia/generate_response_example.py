import time
import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from openai import OpenAI

from config.openia.tools import get_chat_completion_text
from config.openia.config import RETRYABLE_STATUS_CODES



def generate_response_with_retry(
    client: OpenAI,
    model: str,
    max_retries: int = 3,
):
    prompt = "Explica en una frase que es un agente de IA."

    print("*** CHAT COMPLETIONS ****")
    for attempt in range(1, max_retries + 1):
        try:
            return client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
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


def get_response_text(response) -> str:
    return get_chat_completion_text(response)
