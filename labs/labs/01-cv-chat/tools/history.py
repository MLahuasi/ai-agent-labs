import json

from pathlib import Path

from typing import cast
from config.shared.types import ChatMessage
from settings.types import ChatbotMessage


def build_chatbot_history(
    history: list[ChatMessage],
) -> list[ChatbotMessage]:
    return [
        cast(
            ChatbotMessage,
            {
                "role": item["role"],
                "content": item["content"],
            },
        )
        for item in history
        if item["role"] in {"user", "assistant"}
    ]

def save_history(data_dir:Path, history_file:Path, history: list[ChatMessage]) -> None:
    data_dir.mkdir(exist_ok=True)

    with open(history_file, "w", encoding="utf-8") as file:
        json.dump(
            history,
            file,
            indent=4,
            ensure_ascii=False,
        )

def load_history(history_file: Path, model_ia:str, greeting_message:str, system_prompt: str) -> list[ChatMessage]:
    if not history_file.exists():
        return [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "assistant",
                "model": model_ia,
                "content": greeting_message,
            },
        ]
        
    with open(history_file, "r", encoding="utf-8") as file:
        persisted = json.load(file)

    has_system_prompt = any(
        item.get("role") == "system"
        for item in persisted
    )

    if has_system_prompt:
        return persisted

    return [
        {
            "role": "system",
            "content": system_prompt,
        },
        *persisted,
    ]
