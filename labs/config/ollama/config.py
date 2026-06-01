import os

from dotenv import load_dotenv


OLLAMA_DEFAULT_HOST = "http://localhost:11434"
OLLAMA_CODE_MODEL = "qwen2.5-coder:3b"
OLLAMA_GENERAL_MODEL = "gemma3:4b"

OLLAMA_CHAT_OPTIONS: dict[str, object] = {
    "temperature": 0.4,
    "num_predict": 60,
}

RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({
    500,
    502,
    503,
    504,
})


def load_ollama_host() -> str:
    load_dotenv(override=True)

    host = os.getenv("OLLAMA_HOST")

    if not host:
        return OLLAMA_DEFAULT_HOST

    return host

