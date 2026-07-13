import os

from dotenv import load_dotenv


OLLAMA_CHAT_OPTIONS: dict[str, object] = {
    "temperature": 0.1,
    "top_p": 0.7,
    "top_k": 30,
    "repeat_penalty": 1.1,
    "num_predict": 512,
    "num_ctx": 4096,
}


RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({
    408,  # Request Timeout
    429,  # Too Many Requests
    500,  # Internal Server Error
    502,  # Bad Gateway
    503,  # Service Unavailable
    504,  # Gateway Timeout
})


def load_ollama_host() -> str:
    load_dotenv(override=True)

    host = os.getenv("OLLAMA_HOST")

    if not host:
        raise RuntimeError("La variable OLLAMA_HOST no existe en .env")

    return host
