from typing import Any, Callable, Protocol, Sequence

from config.shared.types import ChatRole, ChatMessage


ToolDefinition = dict[str, Any]
HandleToolCalls = Callable[[Any], list[ChatMessage]]


class LlmClientAdapter(Protocol):
    def create_client(self) -> Any:
        ...

    def build_history(self, messages: list[ChatMessage]) -> Any:
        ...

    def send_chat_message_with_retry(
        self,
        *,
        client: Any,
        model: str,
        history: list[ChatMessage],
        question: str | None = None,
        tools: Sequence[ToolDefinition] | None = None,
        max_retries: int = 3,
    ) -> Any:
        ...

    def get_response_text(self, response: Any) -> str:
        ...

    def get_tool_calls(self, response: Any) -> Any | None:
        ...

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[ChatMessage],
        response: Any,
        model: str,
    ) -> None:
        ...

    def ask_chat_question(
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