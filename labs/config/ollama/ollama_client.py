import sys
import time
from pathlib import Path
from typing import Any, Sequence, cast

from ollama import ChatResponse, Client

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.ollama.config import (
    OLLAMA_CHAT_OPTIONS,
    RETRYABLE_STATUS_CODES,
    load_ollama_host,
)
from config.shared.llm_client import (
    HandleToolCalls,
    LlmClientAdapter,
    ToolDefinition,
)
from config.shared.roles import normalize_chat_role
from config.shared.types import ChatMessage, ChatRole


class OllamaLlmClientAdapter(LlmClientAdapter):
    def create_client(self) -> Client:
        return Client(host=load_ollama_host())

    def get_tool_calls(self, response: ChatResponse) -> Any | None:
        message = getattr(response, "message", None)

        if message is None:
            return None

        tool_calls = getattr(message, "tool_calls", None)

        if not tool_calls:
            return None

        return tool_calls

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[ChatMessage],
        response: ChatResponse,
        model: str,
    ) -> None:
        message = getattr(response, "message", None)

        if message is None:
            raise ValueError("Ollama no devolvió un mensaje para tool calls.")

        content = getattr(message, "content", "") or ""
        tool_calls = getattr(message, "tool_calls", None)

        if not tool_calls:
            raise ValueError("Ollama no devolvió tool calls en el mensaje.")

        messages.append(
            {
                "role": "assistant",
                "model": model,
                "content": content,
                "tool_calls": tool_calls,
            }
        )

    def build_history(self, messages: list[ChatMessage]) -> list[dict[str, Any]]:
        history: list[dict[str, Any]] = []

        for message in messages:
            role = normalize_chat_role(message["role"])
            content = message.get("content") or ""

            if role == "system":
                payload: dict[str, Any] = {
                    "role": "system",
                    "content": content,
                }

            elif role == "user":
                payload = {
                    "role": "user",
                    "content": content,
                }

            elif role == "tool":
                payload = {
                    "role": "tool",
                    "content": content,
                }

                tool_call_id = message.get("tool_call_id")
                if tool_call_id is not None:
                    payload["tool_call_id"] = tool_call_id

                tool_name = message.get("name")
                if tool_name is not None:
                    payload["name"] = tool_name

            else:
                payload = {
                    "role": "assistant",
                    "content": content,
                }

                if "tool_calls" in message:
                    payload["tool_calls"] = message["tool_calls"]

            history.append(payload)

        return history

    def send_chat_message_with_retry(
        self,
        *,
        client: Client,
        model: str,
        history: list[ChatMessage],
        question: str | None = None,
        tools: Sequence[ToolDefinition] | None = None,
        max_retries: int = 3,
    ) -> ChatResponse:
        messages = self.build_history(history)

        if question is not None:
            messages.append(
                {
                    "role": "user",
                    "content": question,
                }
            )

        for attempt in range(1, max_retries + 1):
            try:
                chat_fn: Any = client.chat  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]

                if tools is None:
                    return chat_fn(
                        model=model,
                        messages=messages,
                        stream=False,
                        options=OLLAMA_CHAT_OPTIONS,
                    )

                return chat_fn(
                    model=model,
                    messages=messages,
                    stream=False,
                    options=OLLAMA_CHAT_OPTIONS,
                    tools=cast(Any, tools),
                )

            except Exception as error:
                status_code = getattr(error, "status_code", None)

                if status_code not in RETRYABLE_STATUS_CODES:
                    raise

                if attempt == max_retries:
                    raise RuntimeError(
                        f"Ollama no respondió después de {max_retries} intentos. "
                        f"Último error: {status_code}"
                    ) from error

                wait_seconds = 2**attempt
                print(
                    f"Ollama ocupado o con error temporal [{status_code}]. "
                    f"Reintentando en {wait_seconds}s..."
                )
                time.sleep(wait_seconds)

        raise RuntimeError("No se pudo completar la consulta a Ollama.")

    def get_response_text(self, response: ChatResponse) -> str:
        message = getattr(response, "message", None)

        if message is None:
            raise ValueError("Ollama no devolvió un mensaje de respuesta.")

        text = getattr(message, "content", None)

        if text is None:
            raise ValueError("Ollama no devolvió contenido de texto.")

        text = text.strip()

        if not text:
            raise ValueError("Ollama devolvió una respuesta vacía.")

        return text

    def ask_chat_question(
        self,
        *,
        client: Client,
        model: str,
        messages: list[ChatMessage],
        role: ChatRole,
        question: str,
        tools: Sequence[ToolDefinition] | None = None,
        handle_tool_calls: HandleToolCalls | None = None,
        max_tool_iterations: int = 5,
    ) -> str:
        messages.append({"role": role, "content": question})

        for _ in range(max_tool_iterations):
            response = self.send_chat_message_with_retry(
                client=client,
                model=model,
                history=messages,
                question=None,
                tools=tools,
            )

            tool_calls = self.get_tool_calls(response)

            if not tool_calls:
                answer = self.get_response_text(response)

                messages.append(
                    {
                        "role": "assistant",
                        "model": model,
                        "content": answer,
                    }
                )

                return answer

            if handle_tool_calls is None:
                raise RuntimeError(
                    "El modelo solicitó tool calls, pero no se proporcionó "
                    "handle_tool_calls."
                )

            self.append_assistant_tool_call_message(
                messages=messages,
                response=response,
                model=model,
            )

            tool_results = handle_tool_calls(tool_calls)
            messages.extend(tool_results)

        raise RuntimeError(
            f"Se alcanzó el límite de {max_tool_iterations} iteraciones de tools."
        )