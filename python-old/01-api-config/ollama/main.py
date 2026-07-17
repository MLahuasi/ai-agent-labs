import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from chat_example import (
    create_ollama_client,
    execute_chat_custom_example
)
# from config.ollama.config import OLLAMA_CODE_MODEL
from config.shared.types import ChatMessage


MODEL_NAME = "qwen2.5-coder:3b"
# MODEL_NAME = "gemma3:4b"

def main() -> None:

    client = create_ollama_client()

    messages: list[ChatMessage] = []

    execute_chat_custom_example(
        client=client,
        messages=messages,
        model=MODEL_NAME
    )

    print(messages)


if __name__ == "__main__":
    main()
