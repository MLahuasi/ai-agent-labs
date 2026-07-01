from typing import Any, Protocol, Sequence

from config.shared.llm_client import HandleToolCalls, ToolDefinition
from config.shared.types import ChatMessage, ChatRole


class AskChatQuestion(Protocol):
    def __call__(
        self,
        *,
        client: Any,
        model: str,
        messages: list[ChatMessage],
        role: ChatRole,
        question: str,
        tools: Sequence[ToolDefinition] | None = None,
        handle_tool_calls: HandleToolCalls | None = None,
        max_tool_iterations: int = 5,
    ) -> str:
        ...