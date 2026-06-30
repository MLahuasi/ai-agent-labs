from typing import Any, Protocol

from config.shared.types import ChatMessage

class AskChatQuestion(Protocol):
    def __call__(
        self,
        *,
        client: Any,
        model: str,
        messages: list[ChatMessage],
        role: str,
        question: str,
    ) -> str:
        ...
