import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LABS_DIR))

from config.gemini.config import load_gemini_api_key
from config.gemini.gemini_client import create_gemini_client
from chat_example import execute_chat_completion_custom_example


MODEL_NAME = "gemini-2.5-flash-lite"


def main() -> None:
    load_gemini_api_key()

    print("La clave API de Gemini existe.")

    client = create_gemini_client()

    execute_chat_completion_custom_example(
        client=client,
        model=MODEL_NAME
    )


if __name__ == "__main__":
    main()
