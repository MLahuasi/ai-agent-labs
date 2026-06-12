from typing import TypedDict, NotRequired


class ChatMessage(TypedDict):
    role: str
    model:NotRequired[str]
    content: str