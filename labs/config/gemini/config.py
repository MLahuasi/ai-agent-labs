import os

from dotenv import load_dotenv
from google.genai import types


def load_gemini_api_key() -> str:
    load_dotenv(override=True)

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("La variable GEMINI_API_KEY no existe en .env")

    return api_key


GEMINI_GENERATION_CONFIG = types.GenerateContentConfig(
    max_output_tokens=60,
    temperature=0.4,
)

RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({
    500,
    502,
    503,
    504,
})
