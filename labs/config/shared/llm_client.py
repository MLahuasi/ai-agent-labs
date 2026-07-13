from typing import Any, Callable, List, Protocol, Sequence

from config.shared.types import ChatRole, ChatMessage, ToolDefinition


HandleToolCalls = Callable[[Any], list[ChatMessage]]


class LlmClientAdapter(Protocol):
    """
    Contrato común para proveedores de modelos.

    Las implementaciones concretas encapsulan los SDK de OpenAI,
    Gemini, Ollama u otros proveedores.
    """
    def create_client(self) -> Any:
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

        El consumidor trabaja únicamente con listas de números
        y no conoce el formato de respuesta del proveedor.
        """

        ...        

    def build_history(self, messages: list[ChatMessage]) -> Any:
        """Convierte el historial al formato esperado por el proveedor."""
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
        """Envía una consulta implementando la estrategia de reintentos."""
        ...

    def get_response_text(self, response: Any) -> str:
        """Obtiene el texto desde una respuesta del proveedor."""
        ...

    def get_tool_calls(self, response: Any) -> Any | None:
        """Obtiene las llamadas a tools desde la respuesta."""
        ...

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[ChatMessage],
        response: Any,
        model: str,
    ) -> None:
        """Agrega al historial una solicitud de ejecución de tools."""
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
        """Ejecuta el flujo completo de conversación."""
        ...