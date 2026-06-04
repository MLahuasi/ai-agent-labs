import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from chat_example import execute_chat_completion_custom_example, execute_chat_completion_example
from config.ollama.config import OLLAMA_CODE_MODEL, OLLAMA_GENERAL_MODEL
from config.ollama.ollama_client import (
    assert_ollama_server_available,
    create_ollama_client,
    get_ollama_host,
)


MODELS_TO_COMPARE = (
    OLLAMA_CODE_MODEL,
    # OLLAMA_GENERAL_MODEL,
)


def main() -> None:
    host = get_ollama_host()
    assert_ollama_server_available(host)

    client = create_ollama_client()

    print(f"La conexion local de Ollama existe en {host}.")

    for model in MODELS_TO_COMPARE:
        print(f"===== MODELO: {model} =====")

        execute_chat_completion_example(
            client=client,
            model=model,
        )
        execute_chat_completion_custom_example(
            client=client,
            model=model,
        )


if __name__ == "__main__":
    main()
