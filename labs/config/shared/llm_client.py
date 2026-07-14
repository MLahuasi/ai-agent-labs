from typing import Any, Callable, List, Protocol, Sequence

from config.shared.types import (
    ChatMessage,
    ChatRole,
    ChatTurnResult,
    ToolDefinition,
)


# El ejecutor recibe tool calls normalizados por el adapter
# y retorna mensajes role="tool".
HandleToolCalls = Callable[
    [Any],
    list[ChatMessage],
]


class LlmClientAdapter(Protocol):
    """
    Contrato común para todos los proveedores LLM.

    La lógica de negocio depende de esta abstracción y no conoce
    clientes específicos de OpenAI, Gemini, Groq u Ollama.
    """

    def create_client(
        self,
    ) -> Any:
        """Crea el cliente específico del proveedor."""
        ...

    def create_embeddings(
        self,
        *,
        client: Any,
        model: str,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Genera un embedding por cada texto recibido.
        """
        ...

    def build_history(
        self,
        messages: list[ChatMessage],
    ) -> Any:
        """
        Convierte el historial neutral al formato del proveedor.
        """
        ...

    def send_chat_message_with_retry(
        self,
        *,
        client: Any,
        model: str,
        history: list[ChatMessage],
        question: str | None = None,
        tools: List[ToolDefinition] | None = None,
        max_retries: int = 3,
    ) -> Any:
        """
        Envía una solicitud utilizando la estrategia de reintentos
        correspondiente al proveedor.
        """
        ...

    def get_response_text(
        self,
        response: Any,
    ) -> str:
        """
        Obtiene el texto desde la respuesta específica del proveedor.
        """
        ...

    def get_tool_calls(
        self,
        response: Any,
    ) -> Any | None:
        """
        Obtiene las llamadas estructuradas a herramientas.
        """
        ...

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[ChatMessage],
        response: Any,
        model: str,
    ) -> None:
        """
        Agrega la solicitud de tools al historial neutral.
        """
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
    ) -> ChatTurnResult:
        """
        Ejecuta un turno completo.

        Todos los adapters deben retornar ChatTurnResult.
        """
        ...