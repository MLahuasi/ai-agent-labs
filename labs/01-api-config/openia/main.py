import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from chat_example import execute_chat_completion_custom_example, execute_chat_completion_example
from config.openia.config import load_openai_api_key
from config.openia.openai_client import create_openai_client


MODEL_NAME = "gpt-5-nano"


def main() -> None:
    load_openai_api_key()

    print("La clave API de OpenAI existe.")

    client = create_openai_client()

    execute_chat_completion_example(
        client=client,
        model=MODEL_NAME
    )
    execute_chat_completion_custom_example(
        client=client,
        model=MODEL_NAME
    )


if __name__ == "__main__":
    main()
