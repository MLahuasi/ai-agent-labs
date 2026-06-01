import time
import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from google import genai
from google.genai import types
from config.gemini.config import GEMINI_GENERATION_CONFIG, RETRYABLE_STATUS_CODES




def generate_content_with_retry(
    client: genai.Client,
    model: str,
    max_retries: int = 3,
) -> types.GenerateContentResponse:
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part(text="Mi nombre es Mauricio")
            ],
        ),
        types.Content(
            role="model",
            parts=[
                types.Part(text="Mucho gusto Mauricio")
            ],
        ),
        types.Content(
            role="user",
            parts=[
                types.Part(text="¿Cómo me llamo?")
            ],
        ),
    ]

    print("*** CONTENTS ****")
    for attempt in range(1, max_retries + 1):
        try:
            return client.models.generate_content(
                model=model,
                contents=contents,
                config=GEMINI_GENERATION_CONFIG,
            )

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
