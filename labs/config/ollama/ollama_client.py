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


# Permite utilizar los módulos compartidos ubicados en labs/config.
LABS_DIR = (
    Path(__file__)
    .resolve()
    .parents[2]
)

sys.path.insert(
    0,
    str(LABS_DIR),
)


from config.ollama.config import (
    OLLAMA_CHAT_OPTIONS,
    OLLAMA_MAX_TOKENS,
    OLLAMA_TEMPERATURE,
    OLLAMA_TOP_P,
    RETRYABLE_STATUS_CODES,
    load_ollama_host,
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


class OllamaLlmClientAdapter(
    LlmClientAdapter
):
    """
    Adapter para Ollama mediante su API compatible con OpenAI.

    Responsabilidades:

    - crear el cliente local;
    - generar embeddings;
    - convertir el historial neutral;
    - enviar solicitudes;
    - aplicar reintentos técnicos;
    - extraer texto;
    - detectar tool calls estructurados;
    - administrar el protocolo técnico de tools;
    - retornar ChatTurnResult.

    El adapter no conoce:

    - funciones concretas de negocio;
    - record_user_details;
    - record_unknown_question;
    - send_email_to_admin;
    - respuestas posteriores a cada tool;
    - reglas del chatbot.
    """

    def create_client(
        self,
    ) -> OpenAI:
        """
        Crea un cliente OpenAI conectado al servidor local de Ollama.

        La API key es obligatoria para el SDK, pero Ollama local
        no utiliza su valor.
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

        El resultado específico del SDK se convierte a:

            list[list[float]]

        El retriever no conoce detalles del proveedor.
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

        # Se conserva el orden original de los textos.
        ordered_embeddings = sorted(
            response.data,
            key=lambda item: item.index,
        )

        embeddings = [
            item.embedding
            for item in ordered_embeddings
        ]

        if (
            len(embeddings)
            != len(texts)
        ):
            raise RuntimeError(
                "La cantidad de embeddings "
                "generados por Ollama no coincide "
                "con la cantidad de textos."
            )

        return embeddings

    def get_tool_calls(
        self,
        response: ChatCompletion,
    ) -> Any | None:
        """
        Obtiene únicamente tool calls estructurados.

        No se interpreta contenido como:

            record_user_details>{...}

        ni bloques JSON escritos por el modelo.

        Una herramienta solo se considera solicitada cuando
        Ollama la entrega mediante message.tool_calls.
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
        Guarda la solicitud estructurada de tools en el historial neutral.

        Los objetos del SDK se convierten a diccionarios serializables.
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
                "tool calls."
            )

        serializable_tool_calls: list[
            dict[str, Any]
        ] = []

        for tool_call in tool_calls:
            if hasattr(
                tool_call,
                "model_dump",
            ):
                # model_dump() ya retorna dict[str, Any].
                # No se necesita cast.
                serializable_tool_calls.append(
                    tool_call.model_dump(
                        exclude_none=True
                    )
                )

                continue

            # Ruta defensiva para futuras versiones o clientes
            # que retornen directamente diccionarios.
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

                # Una respuesta que solicita tools puede no incluir texto.
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
        Convierte el historial neutral al formato utilizado
        por la API compatible con OpenAI de Ollama.

        También valida la secuencia:

            assistant.tool_calls
                    ↓
                tool result

        Esto permite detectar un historial incompleto antes
        de enviarlo al servidor local.
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

            # Cuando existen tools pendientes, los siguientes mensajes
            # deben corresponder a sus resultados.
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
            # Resultado de una tool
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
                        "El mensaje role='tool' "
                        "no contiene un "
                        "tool_call_id válido."
                    )

                payload[
                    "tool_call_id"
                ] = tool_call_id

                # El nombre ayuda a conservar información semántica
                # del resultado cuando está disponible.
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
            # Solicitud de tools
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

        Cuando existen tools se usa:

            tool_choice="auto"

        El modelo puede:

        - responder normalmente;
        - solicitar una tool.

        No se obliga a utilizar tools para todas las preguntas.
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

        # Opciones específicas que no forman parte
        # de los parámetros estándar del SDK.
        extra_body: dict[
            str,
            Any
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
                if not tools:
                    return (
                        client
                        .chat
                        .completions
                        .create(
                            model=model,
                            messages=messages,
                            temperature=(
                                OLLAMA_TEMPERATURE
                            ),
                            top_p=(
                                OLLAMA_TOP_P
                            ),
                            max_tokens=(
                                OLLAMA_MAX_TOKENS
                            ),
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

                        # El modelo decide si necesita utilizar
                        # alguna herramienta.
                        tool_choice="auto",

                        temperature=(
                            OLLAMA_TEMPERATURE
                        ),
                        top_p=(
                            OLLAMA_TOP_P
                        ),
                        max_tokens=(
                            OLLAMA_MAX_TOKENS
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
                # se propagan inmediatamente.
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
                        "Ollama no respondió después "
                        f"de {max_retries} intentos. "
                        "Último error: "
                        f"{status_code}"
                    ) from error

                wait_seconds = (
                    2**attempt
                )

                print(
                    "Ollama ocupado o con "
                    "error temporal "
                    f"[{status_code}]. "
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
        Obtiene y valida el contenido textual generado por Ollama.
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

    @staticmethod
    def get_tool_name(
        tool_call: Any,
    ) -> str | None:
        """
        Obtiene el nombre de una tool desde la respuesta
        OpenAI-compatible de Ollama.
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

        El adapter no interpreta el propósito funcional
        de cada herramienta.
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

            # json.loads() no proporciona un tipo estático
            # suficientemente específico.
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
        Ejecuta un turno completo de conversación.

        El resultado utiliza el contrato homologado:

            ChatTurnResult

        La lógica común recibe información explícita sobre:

        - respuesta final;
        - uso de tools;
        - tools solicitadas;
        - tools exitosas;
        - cantidad de iteraciones.
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
            # Respuesta final
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
            # El modelo solicitó tools
            # -------------------------------------------------------------

            if (
                handle_tool_calls
                is None
            ):
                raise RuntimeError(
                    "Ollama solicitó tool calls, "
                    "pero no se proporcionó "
                    "handle_tool_calls."
                )

            tool_iterations += 1

            # Conserva la solicitud técnica para completar
            # correctamente el protocolo.
            self.append_assistant_tool_call_message(
                messages=messages,
                response=response,
                model=model,
            )

            # Registra las herramientas solicitadas.
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

            # La ejecución real se mantiene fuera del adapter.
            #
            # handle_tool_calls conoce el registro de funciones
            # de la aplicación.
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
            "para Ollama."
        )