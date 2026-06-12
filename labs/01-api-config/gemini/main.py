import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.shared.types import ChatMessage
from chat_example import create_gemini_client, execute_chat_custom_example


MODEL_NAME = "gemini-2.5-flash-lite"


def main() -> None:

    client = create_gemini_client()

    messages: list[ChatMessage] = []

    execute_chat_custom_example (
        client=client,
        messages=messages,
        model=MODEL_NAME
    )

    print(messages)


if __name__ == "__main__":
    main()
