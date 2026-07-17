import os

from dotenv import load_dotenv


GROQ_BASE_URL = "https://api.groq.com/openai/v1"

GROQ_DEFAULT_MODEL = (
    "llama-3.3-70b-versatile"
)


def load_groq_api_key() -> str:
    load_dotenv(override=True)

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError("La variable GROQ_API_KEY no existe en .env")

    return api_key


RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({
    500,
    502,
    503,
    504,
})
