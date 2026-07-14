import json
import sys
import time

from pathlib import Path
from typing import (
    Any,
    Sequence,
    cast,
)

from openai import OpenAI

from openai.types.chat import (
    ChatCompletion,
    ChatCompletionMessageParam,
)


# Permite importar los módulos compartidos ubicados en labs/config.
LABS_DIR = (
    Path(__file__)
    .resolve()
    .parents[2]
)

sys.path.insert(
    0,
    str(LABS_DIR),
)


from config.groq.config import (
    GROQ_BASE_URL,
    RETRYABLE_STATUS_CODES,
    load_groq_api_key,
)

from config.shared.llm_client import (
    HandleToolCalls,
    LlmClientAdapter,
)

from config.shared.roles import (
    normalize_chat_role,
)

from config.shared.types import (
    ChatMessage,
    ChatRole,
    ChatTurnResult,
    ToolDefinition,
)


class GroqLlmClientAdapter(
    LlmClientAdapter
):
    """
    Adapter para Groq.

    Groq expone una API compatible con OpenAI, pero el resto de la
    aplicación no debe depender de ese detalle.

    Responsabilidades:

    - crear el cliente configurado para Groq;
    - convertir el historial neutral al formato del SDK;
    - enviar solicitudes con reintentos técnicos;
    - obtener texto y tool calls;
    - administrar el protocolo técnico de tool calling;
    - retornar ChatTurnResult.

    El adapter no conoce:

    - las funciones reales disponibles;
    - reglas específicas del chatbot;
    - respuestas contractuales posteriores a tools;
    - lógica de record_user_details;
    - lógica de record_unknown_question.
    """

    def create_client(
        self,
    ) -> OpenAI:
        """
        Crea el cliente OpenAI-compatible configurado
        para utilizar la API de Groq.
        """

        return OpenAI(
            api_key=(
                load_groq_api_key()
            ),
            base_url=(
                GROQ_BASE_URL
            ),
        )

    def create_embeddings(
        self,
        *,
        client: OpenAI,
        model: str,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Groq se utiliza únicamente como proveedor de chat.

        El flujo RAG debe recibir otro adapter especializado
        en embeddings, como Ollama, Gemini u OpenAI.
        """

        # Los parámetros pertenecen al contrato común,
        # pero Groq no implementa esta capacidad.
        del client
        del model
        del texts

        raise NotImplementedError(
            "GroqLlmClientAdapter no soporta "
            "generación de embeddings. "
            "Configura un adapter independiente "
            "para el flujo RAG."
        )

    def get_tool_calls(
        self,
        response: ChatCompletion,
    ) -> Any | None:
        """
        Obtiene las llamadas estructuradas a tools.

        No se intenta interpretar texto que parezca una llamada.

        Una tool solamente se considera solicitada cuando la API
        la devuelve mediante message.tool_calls.
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
        Agrega al historial neutral la solicitud de tools.

        Los objetos del SDK se convierten a diccionarios
        serializables antes de salir del adapter.
        """

        if not response.choices:
            raise ValueError(
                "Groq no devolvió opciones "
                "de respuesta."
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
                "Groq no devolvió tool calls."
            )

        serializable_tool_calls: list[
            dict[str, Any]
        ] = []

        for tool_call in tool_calls:
            if hasattr(
                tool_call,
                "model_dump",
            ):

                serialized = tool_call.model_dump(
                    exclude_none=True
                )
                
                serializable_tool_calls.append(
                    serialized
                )

                continue

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
        Convierte el historial neutral al formato compatible
        con la API de Groq.

        También valida la secuencia técnica:

        assistant con tool_calls
            ↓
        uno o más mensajes role="tool"

        Esto permite detectar historiales incompletos antes
        de enviar la solicitud al proveedor.
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

            # Mientras existan tool calls pendientes,
            # solamente se aceptan mensajes role="tool".
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

            payload: dict[
                str,
                Any
            ] = {
                "role": role,
                "content": (
                    message.get(
                        "content"
                    )
                ),
            }

            # -------------------------------------------------------------
            # Resultado de una herramienta
            # -------------------------------------------------------------

            if role == "tool":
                tool_call_id = (
                    message.get(
                        "tool_call_id"
                    )
                )

                if not isinstance(
                    tool_call_id,
                    str,
                ):
                    raise ValueError(
                        "El mensaje con role='tool' "
                        "no contiene un "
                        "tool_call_id válido."
                    )

                payload[
                    "tool_call_id"
                ] = tool_call_id

                # El nombre es opcional para el protocolo compatible
                # con OpenAI, pero se conserva cuando está disponible.
                tool_name = (
                    message.get(
                        "name"
                    )
                )

                if isinstance(
                    tool_name,
                    str,
                ):
                    payload[
                        "name"
                    ] = tool_name

                if (
                    tool_call_id
                    in pending_tool_call_ids
                ):
                    pending_tool_call_ids.remove(
                        tool_call_id
                    )

            # -------------------------------------------------------------
            # Solicitud de herramientas
            # -------------------------------------------------------------

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
                "Historial inválido: existen "
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
        Envía una solicitud a Groq.

        Solamente reintenta errores configurados como temporales.

        Cuando existen tools se utiliza explícitamente:

            tool_choice="auto"

        El modelo puede:

        - responder normalmente;
        - solicitar una tool cuando la considera necesaria.
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

        for attempt in range(
            1,
            max_retries + 1,
        ):
            try:
                if not tools:
                    return (
                        client
                        .chat
                        .completions
                        .create(
                            model=model,
                            messages=messages,
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

                        # AUTO es adecuado para un chatbot:
                        #
                        # - no obliga tools en preguntas conocidas;
                        # - permite solicitarlas cuando corresponden.
                        tool_choice="auto",
                    )
                )

            except Exception as error:
                status_code = getattr(
                    error,
                    "status_code",
                    None,
                )

                if (
                    status_code
                    not in
                    RETRYABLE_STATUS_CODES
                ):
                    raise

                if (
                    attempt
                    == max_retries
                ):
                    raise RuntimeError(
                        "Groq no respondió después "
                        f"de {max_retries} intentos. "
                        "Último error: "
                        f"{status_code}"
                    ) from error

                wait_seconds = (
                    2**attempt
                )

                print(
                    "Groq ocupado o con "
                    "error temporal "
                    f"[{status_code}]. "
                    "Reintentando en "
                    f"{wait_seconds}s..."
                )

                time.sleep(
                    wait_seconds
                )

        # Salvaguarda para el analizador de tipos.
        raise RuntimeError(
            "No se pudo completar "
            "la consulta a Groq."
        )

    def get_response_text(
        self,
        response: ChatCompletion,
    ) -> str:
        """
        Obtiene y valida el contenido textual de Groq.
        """

        if not response.choices:
            raise ValueError(
                "Groq no devolvió opciones "
                "de respuesta."
            )

        text = (
            response
            .choices[0]
            .message
            .content
        )

        if text is None:
            raise ValueError(
                "Groq no devolvió "
                "contenido de texto."
            )

        text = text.strip()

        if not text:
            raise ValueError(
                "Groq devolvió "
                "una respuesta vacía."
            )

        return text

    @staticmethod
    def get_tool_name(
        tool_call: Any,
    ) -> str | None:
        """
        Obtiene el nombre de una tool desde el objeto
        retornado por el SDK OpenAI-compatible.
        """

        function = getattr(
            tool_call,
            "function",
            None,
        )

        name = getattr(
            function,
            "name",
            None,
        )

        if not isinstance(
            name,
            str,
        ):
            return None

        name = name.strip()

        return name or None

    @staticmethod
    def get_successful_tool_names(
        tool_results: list[
            ChatMessage
        ],
    ) -> list[str]:
        """
        Obtiene las tools cuyo resultado informó:

            status = "ok"

        El adapter solamente registra el estado técnico.

        No interpreta el significado funcional de la tool.
        """

        successful_tool_names: list[
            str
        ] = []

        for result in tool_results:
            name = result.get(
                "name"
            )

            content = result.get(
                "content"
            )

            if not isinstance(
                name,
                str,
            ):
                continue

            if not isinstance(
                content,
                str,
            ):
                continue

            try:
                parsed_content: object = (
                    json.loads(
                        content
                    )
                )

            except json.JSONDecodeError:
                continue

            if not isinstance(
                parsed_content,
                dict,
            ):
                continue

            payload = cast(
                dict[str, object],
                parsed_content,
            )

            status = payload.get(
                "status"
            )

            if status != "ok":
                continue

            if (
                name
                not in
                successful_tool_names
            ):
                successful_tool_names.append(
                    name
                )

        return successful_tool_names

    def ask_chat_question(
        self,
        *,
        client: OpenAI,
        model: str,
        messages: list[
            ChatMessage
        ],
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
    ) -> ChatTurnResult:
        """
        Ejecuta un turno completo mediante Groq.

        Retorna el contrato común ChatTurnResult:

        - content;
        - used_tools;
        - tool_names;
        - successful_tool_names;
        - tool_iterations.

        La lógica compartida puede conocer el resultado del turno
        sin inspeccionar posiciones recientes del historial.
        """

        messages.append(
            {
                "role": role,
                "content": question,
            }
        )

        tool_names: list[
            str
        ] = []

        successful_tool_names: list[
            str
        ] = []

        tool_iterations = 0

        for _ in range(
            max_tool_iterations
        ):
            response = (
                self
                .send_chat_message_with_retry(
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

            # -------------------------------------------------------------
            # Respuesta final sin nuevas tools
            # -------------------------------------------------------------

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

                return {
                    "content": answer,
                    "used_tools": bool(
                        tool_names
                    ),
                    "tool_names": (
                        tool_names
                    ),
                    "successful_tool_names": (
                        successful_tool_names
                    ),
                    "tool_iterations": (
                        tool_iterations
                    ),
                }

            # -------------------------------------------------------------
            # El modelo solicitó una o más tools
            # -------------------------------------------------------------

            if (
                handle_tool_calls
                is None
            ):
                raise RuntimeError(
                    "Groq solicitó tool calls, "
                    "pero no se proporcionó "
                    "handle_tool_calls."
                )

            tool_iterations += 1

            # Conserva el mensaje assistant con tool_calls
            # para completar correctamente el protocolo.
            self.append_assistant_tool_call_message(
                messages=messages,
                response=response,
                model=model,
            )

            # Registra las tools solicitadas.
            for tool_call in tool_calls:
                tool_name = (
                    self.get_tool_name(
                        tool_call
                    )
                )

                if tool_name is None:
                    continue

                if (
                    tool_name
                    not in tool_names
                ):
                    tool_names.append(
                        tool_name
                    )

            # La ejecución real permanece fuera del adapter.
            #
            # handle_tool_calls conoce el registro de funciones
            # disponible en la aplicación.
            tool_results = (
                handle_tool_calls(
                    tool_calls
                )
            )

            messages.extend(
                tool_results
            )

            current_successful_names = (
                self
                .get_successful_tool_names(
                    tool_results
                )
            )

            for tool_name in (
                current_successful_names
            ):
                if (
                    tool_name
                    not in
                    successful_tool_names
                ):
                    successful_tool_names.append(
                        tool_name
                    )

        raise RuntimeError(
            "Se alcanzó el límite de "
            f"{max_tool_iterations} "
            "iteraciones de tools "
            "para Groq."
        )