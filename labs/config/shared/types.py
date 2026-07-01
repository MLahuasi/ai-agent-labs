from typing import Any, Literal, NotRequired, TypedDict


ChatRole = Literal[
    "system",
    "user",
    "assistant",
    "tool",
]


class ChatMessage(TypedDict):
    role: ChatRole
    content: str | None
    model: NotRequired[str]
    tool_call_id: NotRequired[str]
    tool_calls: NotRequired[Any]
    name: NotRequired[str]


class ChatResponse(TypedDict):
    content: str
    model: str