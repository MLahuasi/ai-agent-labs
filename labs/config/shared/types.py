from typing import Any, Literal, NotRequired, TypedDict


ChatRole = Literal[
    "system",
    "user",
    "assistant",
    "tool",
]


class ChatMessage(TypedDict):
    role: str
    content: NotRequired[str | None]
    model: NotRequired[str]
    name: NotRequired[str]
    tool_call_id: NotRequired[str]
    tool_calls: NotRequired[list[dict[str, Any]]]


class ChatResponse(TypedDict):
    content: str
    model: str