import os

from dotenv import load_dotenv


def load_openai_api_key() -> str:
    load_dotenv(override=True)

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise RuntimeError("La variable OPENAI_API_KEY no existe en .env")

    return api_key


RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({
    500,
    502,
    503,
    504,
})
