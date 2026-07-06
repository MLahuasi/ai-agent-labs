import json
import sys
import time
from pathlib import Path
from typing import Any, Sequence, cast
from uuid import uuid4

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


ALLOWED_SYNTHETIC_TOOL_NAMES = {
    "record_user_details",
    "record_unknown_question",
    "send_email_to_admin"
}


class OllamaLlmClientAdapter(LlmClientAdapter):
    def create_client(self) -> Client:
        return Client(host=load_ollama_host())

    def extract_json_content(self, content: str) -> str:
        text = content.strip()

        if not text.startswith("```"):
            return text

        lines = text.splitlines()

        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        return "\n".join(lines).strip()

    def parse_synthetic_tool_call(
        self,
        content: str,
    ) -> tuple[str, dict[str, Any]] | None:
        json_content = self.extract_json_content(content)

        try:
            raw_payload: Any = json.loads(json_content)
        except json.JSONDecodeError:
            return None

        if not isinstance(raw_payload, dict):
            return None

        payload = cast(dict[str, Any], raw_payload)

        tool_name = payload.get("name")

        if not isinstance(tool_name, str):
            return None

        raw_arguments = payload.get("arguments")

        if raw_arguments is None:
            arguments: dict[str, Any] = {}
        elif isinstance(raw_arguments, dict):
            arguments = cast(dict[str, Any], raw_arguments)
        else:
            return None

        return tool_name, arguments

    def build_synthetic_tool_calls(
        self,
        content: str,
    ) -> list[dict[str, Any]] | None:
        parsed = self.parse_synthetic_tool_call(content)

        if parsed is None:
            return None

        tool_name, arguments = parsed

        if tool_name not in ALLOWED_SYNTHETIC_TOOL_NAMES:
            return None

        return [
            {
                "id": f"ollama-tool-call-{uuid4().hex}",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": arguments,
                },
            }
        ]

    def get_tool_calls(self, response: ChatResponse) -> Any | None:
        message = getattr(response, "message", None)

        if message is None:
            return None

        tool_calls = getattr(message, "tool_calls", None)

        if tool_calls:
            return tool_calls

        content = getattr(message, "content", None)

        if not isinstance(content, str) or not content.strip():
            return None

        return self.build_synthetic_tool_calls(content)

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

        native_tool_calls = getattr(message, "tool_calls", None)
        content = getattr(message, "content", "") or ""

        tool_calls = self.get_tool_calls(response)

        if not tool_calls:
            raise ValueError("Ollama no devolvió tool calls en el mensaje.")

        # Cuando Ollama simula una tool call escribiendo JSON en content,
        # no debemos guardar ese JSON como contenido visible del assistant.
        # Si lo guardamos, el modelo tiende a seguir respondiendo con JSON/tools.
        if not native_tool_calls:
            content = ""

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

    def build_final_response_after_tool(self, tool_name: str) -> str:
        if tool_name == "record_user_details":
            return (
                "Gracias, he enviado la notificación correctamente. "
                "Te responderé por correo para coordinar el contacto."
            )

        if tool_name == "record_unknown_question":
            return (
                "No tengo ese dato confirmado en este momento. "
                "Puedo hablarte mejor sobre mi experiencia profesional, "
                "proyectos o enfoque de desarrollo."
            )

        return (
            "No tengo ese dato confirmado en este momento. "
            "Puedo hablarte mejor sobre mi experiencia profesional, "
            "proyectos o enfoque de desarrollo."
        )

    def get_last_tool_name(self, messages: list[ChatMessage]) -> str | None:
        for message in reversed(messages):
            if message.get("role") == "tool":
                tool_name = message.get("name")

                if isinstance(tool_name, str):
                    return tool_name

        return None

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

        tool_was_executed = False

        for _ in range(max_tool_iterations):
            # Para Ollama, después de ejecutar una tool, la siguiente llamada
            # debe pedir una respuesta final textual, no permitir otra tool.
            current_tools = None if tool_was_executed else tools

            response = self.send_chat_message_with_retry(
                client=client,
                model=model,
                history=messages,
                question=None,
                tools=current_tools,
            )

            tool_calls = self.get_tool_calls(response) if current_tools else None

            if not tool_calls:
                answer = self.get_response_text(response)

                # Si ya se ejecutó una tool y el modelo vuelve a responder con
                # un JSON de herramienta, no mostramos ese JSON en Gradio.
                if tool_was_executed and self.parse_synthetic_tool_call(answer):
                    last_tool_name = self.get_last_tool_name(messages)
                    answer = self.build_final_response_after_tool(
                        last_tool_name or ""
                    )

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
            tool_was_executed = True

        raise RuntimeError(
            f"Se alcanzó el límite de {max_tool_iterations} iteraciones de tools."
        )