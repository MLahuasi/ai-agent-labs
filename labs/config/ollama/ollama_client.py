import sys
import time

from pathlib import Path
from typing import Any, Sequence, cast

from openai import OpenAI
from openai.types.chat import (
    ChatCompletion,
    ChatCompletionMessageParam,
)


LABS_DIR = Path(__file__).resolve().parents[2]

sys.path.insert(
    0,
    str(LABS_DIR),
)


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
from config.shared.types import (
    ChatMessage,
    ChatRole,
)


class OllamaLlmClientAdapter(
    LlmClientAdapter
):
    def create_client(
        self,
    ) -> OpenAI:
        """
        Crea un cliente compatible con OpenAI
        conectado al servidor local de Ollama.
        """

        ollama_host = (
            load_ollama_host()
            .rstrip("/")
        )

        return OpenAI(
            base_url=(
                f"{ollama_host}/v1"
            ),
            api_key="ollama",
        )

    def create_embeddings(
        self,
        *,
        client: OpenAI,
        model: str,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Genera embeddings mediante Ollama.

        La respuesta específica del proveedor se adapta
        al contrato común utilizado por el flujo RAG.
        """

        if not texts:
            return []

        response = (
            client
            .embeddings
            .create(
                model=model,
                input=texts,
                encoding_format="float",
            )
        )

        # Conserva el orden original de los textos.
        ordered_embeddings = sorted(
            response.data,
            key=lambda item: item.index,
        )

        embeddings = [
            item.embedding
            for item in ordered_embeddings
        ]

        if len(embeddings) != len(texts):
            raise RuntimeError(
                "La cantidad de embeddings generados "
                "por Ollama no coincide con la cantidad "
                "de textos."
            )

        return embeddings

    def get_tool_calls(
        self,
        response: ChatCompletion,
    ) -> Any | None:
        """
        Obtiene las solicitudes de ejecución
        de tools generadas por Ollama.
        """

        if not response.choices:
            return None

        message = (
            response
            .choices[0]
            .message
        )

        tool_calls = getattr(
            message,
            "tool_calls",
            None,
        )

        if not tool_calls:
            return None

        return tool_calls

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[ChatMessage],
        response: ChatCompletion,
        model: str,
    ) -> None:
        """
        Agrega al historial la solicitud
        de ejecución de tools.
        """

        if not response.choices:
            raise ValueError(
                "Ollama no devolvió "
                "opciones de respuesta."
            )

        message = (
            response
            .choices[0]
            .message
        )

        tool_calls = (
            message.tool_calls
            or []
        )

        if not tool_calls:
            raise ValueError(
                "Ollama no devolvió "
                "tool calls en el mensaje."
            )

        serializable_tool_calls: list[
            dict[str, Any]
        ] = []

        for tool_call in tool_calls:
            if hasattr(
                tool_call,
                "model_dump",
            ):
                serializable_tool_calls.append(
                    tool_call.model_dump(
                        exclude_none=True
                    )
                )
            else:
                serializable_tool_calls.append(
                    cast(
                        dict[str, Any],
                        tool_call,
                    )
                )

        messages.append(
            {
                "role": "assistant",
                "model": model,
                "content": (
                    message.content
                    or ""
                ),
                "tool_calls": (
                    serializable_tool_calls
                ),
            }
        )

    def build_history(
        self,
        messages: list[ChatMessage],
    ) -> list[
        ChatCompletionMessageParam
    ]:
        """
        Convierte el historial común al formato
        compatible con la API OpenAI de Ollama.
        """

        history: list[
            ChatCompletionMessageParam
        ] = []

        pending_tool_call_ids: list[
            str
        ] = []

        for message in messages:
            role = normalize_chat_role(
                message["role"]
            )

            if (
                pending_tool_call_ids
                and role != "tool"
            ):
                raise ValueError(
                    "Historial inválido: un mensaje "
                    "assistant con tool_calls debe estar "
                    "seguido inmediatamente por mensajes "
                    "role='tool'. "
                    "Tool calls pendientes: "
                    f"{pending_tool_call_ids}"
                )

            content = (
                message.get("content")
                or ""
            )

            payload: dict[str, Any] = {
                "role": role,
                "content": content,
            }

            if role == "tool":
                tool_call_id = (
                    message.get(
                        "tool_call_id"
                    )
                )

                if tool_call_id is None:
                    raise ValueError(
                        "El mensaje con role='tool' "
                        "no tiene tool_call_id."
                    )

                payload[
                    "tool_call_id"
                ] = tool_call_id

                if (
                    tool_call_id
                    in pending_tool_call_ids
                ):
                    pending_tool_call_ids.remove(
                        tool_call_id
                    )

            if role == "assistant":
                tool_calls = (
                    message.get(
                        "tool_calls"
                    )
                )

                if tool_calls:
                    payload[
                        "tool_calls"
                    ] = tool_calls

                    pending_tool_call_ids = []

                    for tool_call in tool_calls:
                        tool_call_id = (
                            tool_call.get(
                                "id"
                            )
                        )

                        if isinstance(
                            tool_call_id,
                            str,
                        ):
                            pending_tool_call_ids.append(
                                tool_call_id
                            )

                    if not pending_tool_call_ids:
                        raise ValueError(
                            "El mensaje assistant contiene "
                            "tool_calls, pero no se pudieron "
                            "obtener sus identificadores."
                        )

            history.append(
                cast(
                    ChatCompletionMessageParam,
                    payload,
                )
            )

        if pending_tool_call_ids:
            raise ValueError(
                "Historial inválido: quedaron "
                "tool calls sin respuesta. "
                "Tool calls pendientes: "
                f"{pending_tool_call_ids}"
            )

        return history

    def send_chat_message_with_retry(
        self,
        *,
        client: OpenAI,
        model: str,
        history: list[ChatMessage],
        question: str | None = None,
        tools: Sequence[
            ToolDefinition
        ]
        | None = None,
        max_retries: int = 3,
    ) -> ChatCompletion:
        """
        Envía una consulta a Ollama.

        Los errores temporales se reintentan utilizando
        espera exponencial. Los errores no recuperables,
        como un modelo sin soporte de tools, se propagan
        inmediatamente.
        """

        messages = self.build_history(
            history
        )

        if question is not None:
            messages.append(
                cast(
                    ChatCompletionMessageParam,
                    {
                        "role": "user",
                        "content": question,
                    },
                )
            )

        extra_body: dict[
            str,
            Any,
        ] = {}

        if OLLAMA_CHAT_OPTIONS:
            extra_body[
                "options"
            ] = OLLAMA_CHAT_OPTIONS

        for attempt in range(
            1,
            max_retries + 1,
        ):
            try:
                if tools is None:
                    return (
                        client
                        .chat
                        .completions
                        .create(
                            model=model,
                            messages=messages,
                            extra_body=(
                                extra_body
                            ),
                        )
                    )

                return (
                    client
                    .chat
                    .completions
                    .create(
                        model=model,
                        messages=messages,
                        tools=cast(
                            Any,
                            tools,
                        ),
                        extra_body=(
                            extra_body
                        ),
                    )
                )

            except Exception as error:
                status_code = getattr(
                    error,
                    "status_code",
                    None,
                )

                # Los errores no configurados como temporales
                # se propagan sin ejecutar reintentos.
                if (
                    status_code
                    not in RETRYABLE_STATUS_CODES
                ):
                    raise

                if attempt == max_retries:
                    raise RuntimeError(
                        "Ollama no respondió después "
                        f"de {max_retries} intentos. "
                        "Último error: "
                        f"{status_code}"
                    ) from error

                wait_seconds = 2**attempt

                print(
                    "Ollama ocupado o con error "
                    f"temporal [{status_code}]. "
                    "Reintentando en "
                    f"{wait_seconds}s..."
                )

                time.sleep(
                    wait_seconds
                )

        raise RuntimeError(
            "No se pudo completar "
            "la consulta a Ollama."
        )

    def get_response_text(
        self,
        response: ChatCompletion,
    ) -> str:
        """
        Obtiene el contenido textual
        de una respuesta de Ollama.
        """

        if not response.choices:
            raise ValueError(
                "Ollama no devolvió "
                "opciones de respuesta."
            )

        text = (
            response
            .choices[0]
            .message
            .content
        )

        if text is None:
            raise ValueError(
                "Ollama no devolvió "
                "contenido de texto."
            )

        text = text.strip()

        if not text:
            raise ValueError(
                "Ollama devolvió "
                "una respuesta vacía."
            )

        return text

    def ask_chat_question(
        self,
        *,
        client: OpenAI,
        model: str,
        messages: list[ChatMessage],
        role: ChatRole,
        question: str,
        tools: Sequence[
            ToolDefinition
        ]
        | None = None,
        handle_tool_calls: (
            HandleToolCalls
            | None
        ) = None,
        max_tool_iterations: int = 5,
    ) -> str:
        """
        Ejecuta el flujo completo de conversación
        y procesa las tools solicitadas por Ollama.
        """

        messages.append(
            {
                "role": role,
                "content": question,
            }
        )

        for _ in range(
            max_tool_iterations
        ):
            response = (
                self.send_chat_message_with_retry(
                    client=client,
                    model=model,
                    history=messages,
                    question=None,
                    tools=tools,
                )
            )

            tool_calls = (
                self.get_tool_calls(
                    response
                )
            )

            if not tool_calls:
                answer = (
                    self.get_response_text(
                        response
                    )
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
                    "El modelo solicitó tool calls, "
                    "pero no se proporcionó "
                    "handle_tool_calls."
                )

            self.append_assistant_tool_call_message(
                messages=messages,
                response=response,
                model=model,
            )

            tool_results = (
                handle_tool_calls(
                    tool_calls
                )
            )

            messages.extend(
                tool_results
            )

        raise RuntimeError(
            "Se alcanzó el límite de "
            f"{max_tool_iterations} "
            "iteraciones de tools."
        )

