import json
import sys
import time

from pathlib import Path
from typing import (
    Any,
    Mapping,
    Sequence,
    cast,
)

from google import genai

from google.genai import (
    Client,
    types,
)


LABS_DIR = (
    Path(__file__)
    .resolve()
    .parents[2]
)

sys.path.insert(
    0,
    str(LABS_DIR),
)


from config.gemini.config import (
    RETRYABLE_STATUS_CODES,
    load_gemini_api_key,
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
    ToolCallDict,
    ToolDefinition,
)


class GeminiLlmClientAdapter(
    LlmClientAdapter
):
    """
    Adapter para Gemini.

    Responsabilidades:

    - crear el cliente Gemini;
    - generar embeddings;
    - transformar el historial neutral al formato Gemini;
    - transformar tools comunes a FunctionDeclaration;
    - normalizar FunctionCall al contrato interno;
    - aplicar reintentos técnicos;
    - administrar el protocolo técnico de function calling.

    El adapter no conoce:

    - reglas específicas del chatbot;
    - funciones disponibles en la aplicación;
    - respuestas contractuales después de tools;
    - comportamiento de record_user_details;
    - comportamiento de record_unknown_question.
    """

    def __init__(
        self,
    ) -> None:
        """
        Inicializa el estado técnico exclusivo de Gemini.

        thought_signature no forma parte del contrato compartido
        de tools porque es un metadato específico del proveedor.

        La firma se conserva únicamente durante el turno actual
        para poder reenviarla junto con el FunctionCall.
        """

        self._thought_signatures: dict[
            str,
            bytes,
        ] = {}

    def store_thought_signature(
        self,
        *,
        tool_call_id: str,
        thought_signature: object,
    ) -> None:
        """
        Conserva la firma opaca retornada por Gemini.

        La firma no se interpreta, modifica ni persiste.
        Solo se reutiliza al reconstruir el historial técnico
        dentro del mismo turno.
        """

        if thought_signature is None:
            return

        if isinstance(
            thought_signature,
            bytearray,
        ):
            self._thought_signatures[
                tool_call_id
            ] = bytes(
                thought_signature
            )

            return

        if not isinstance(
            thought_signature,
            bytes,
        ):
            raise ValueError(
                "Gemini devolvió una "
                "thought_signature con "
                "un formato inválido."
            )

        self._thought_signatures[
            tool_call_id
        ] = thought_signature

    def get_thought_signature(
        self,
        tool_call_id: str,
    ) -> bytes | None:
        """
        Obtiene la firma asociada a una llamada de tool.

        Otros adapters no conocen ni utilizan este metadato.
        """

        return (
            self
            ._thought_signatures
            .get(
                tool_call_id
            )
        )

    def create_client(
        self,
    ) -> Client:
        """
        Crea el cliente específico de Gemini.
        """

        load_gemini_api_key()

        return genai.Client()

    def build_config(
        self,
        *,
        messages: list[ChatMessage],
        tools: Sequence[
            ToolDefinition
        ]
        | None = None,
    ) -> types.GenerateContentConfig:
        """
        Construye la configuración utilizada por Gemini.

        La configuración se crea directamente utilizando los tipos
        específicos del SDK.

        No se utiliza dict[str, object] ni model_dump(), porque esa
        conversión elimina la información de tipos y genera errores
        innecesarios en Pyright/Pylance.
        """

        system_instruction = (
            self.get_system_instruction(
                messages
            )
        )

        gemini_tools = (
            self.build_gemini_tools(
                tools
            )
        )

        # Sin herramientas se utiliza una configuración simple.
        if gemini_tools is None:
            return (
                types.GenerateContentConfig(
                    system_instruction=(
                        system_instruction
                    ),
                    max_output_tokens=400,
                    temperature=0.4,
                )
            )

        return (
            types.GenerateContentConfig(
                system_instruction=(
                    system_instruction
                ),
                max_output_tokens=400,
                temperature=0.4,
                tools=gemini_tools,

                # Las funciones reales no se entregan al SDK.
                #
                # Gemini solicita la función y la aplicación
                # la ejecuta mediante handle_tool_calls.
                automatic_function_calling=(
                    types
                    .AutomaticFunctionCallingConfig(
                        disable=True
                    )
                ),

                tool_config=(
                    types.ToolConfig(
                        function_calling_config=(
                            types
                            .FunctionCallingConfig(
                                # El SDK espera el enum y no
                                # el string literal "AUTO".
                                mode=(
                                    types
                                    .FunctionCallingConfigMode
                                    .AUTO
                                )
                            )
                        )
                    )
                ),
            )
        )


    def create_embeddings(
        self,
        *,
        client: Client,
        model: str,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Genera un embedding por cada texto.

        El resultado específico del SDK se transforma
        a list[list[float]], que es el contrato neutral
        utilizado por el componente RAG.
        """

        if not texts:
            return []

        # El SDK acepta una lista de textos, pero Pyright
        # no siempre resuelve correctamente ContentListUnion.
        contents = cast(
            types.ContentListUnion,
            texts,
        )

        response = (
            client.models.embed_content(
                model=model,
                contents=contents,
            )
        )

        embeddings = (
            response.embeddings
        )

        if embeddings is None:
            raise ValueError(
                "Gemini no devolvió embeddings."
            )

        result: list[
            list[float]
        ] = []

        for embedding in embeddings:
            values = embedding.values

            if values is None:
                raise ValueError(
                    "Gemini devolvió un "
                    "embedding sin valores."
                )

            result.append(
                list(values)
            )

        if len(result) != len(texts):
            raise RuntimeError(
                "La cantidad de embeddings "
                "generados por Gemini no "
                "coincide con la cantidad "
                "de textos."
            )

        return result

    def build_gemini_tools(
        self,
        tools: Sequence[
            ToolDefinition
        ]
        | None,
    ) -> list[types.Tool] | None:
        """
        Convierte las definiciones neutrales de tools
        al formato FunctionDeclaration de Gemini.

        Las definiciones originales permanecen fuera
        del adapter y pueden ser utilizadas por cualquier
        proveedor.
        """

        if not tools:
            return None

        function_declarations: list[
            types.FunctionDeclaration
        ] = []

        for tool in tools:
            tool_data = cast(
                dict[str, object],
                tool,
            )

            function_data_raw = (
                tool_data.get(
                    "function"
                )
            )

            if not isinstance(
                function_data_raw,
                dict,
            ):
                raise ValueError(
                    "La definición de una tool "
                    "no contiene un objeto "
                    "'function' válido."
                )

            function_data = cast(
                Mapping[
                    str,
                    object,
                ],
                function_data_raw,
            )

            name_raw = (
                function_data.get(
                    "name"
                )
            )

            description_raw = (
                function_data.get(
                    "description"
                )
            )

            parameters_raw = (
                function_data.get(
                    "parameters"
                )
            )

            if not isinstance(
                name_raw,
                str,
            ):
                raise ValueError(
                    "La definición de una tool "
                    "no contiene un nombre válido."
                )

            if not isinstance(
                description_raw,
                str,
            ):
                raise ValueError(
                    "La definición de la tool "
                    f"'{name_raw}' no contiene "
                    "una descripción válida."
                )

            if not isinstance(
                parameters_raw,
                dict,
            ):
                raise ValueError(
                    "La definición de la tool "
                    f"'{name_raw}' no contiene "
                    "un esquema de parámetros válido."
                )

            parameters = cast(
                dict[str, object],
                parameters_raw,
            )

            function_declarations.append(
                types.FunctionDeclaration(
                    name=name_raw,
                    description=(
                        description_raw
                    ),
                    parameters_json_schema=(
                        parameters
                    ),
                )
            )

        return [
            types.Tool(
                function_declarations=(
                    function_declarations
                ),
            )
        ]

    @staticmethod
    def get_system_instruction(
        messages: list[
            ChatMessage
        ],
    ) -> str | None:
        """
        Obtiene el system prompt desde el historial neutral.

        Gemini maneja las instrucciones del sistema mediante
        system_instruction.

        No se convierte el system prompt en un mensaje user,
        porque eso cambia su semántica.
        """

        for message in messages:
            role = normalize_chat_role(
                message["role"]
            )

            if role != "system":
                continue

            content = message.get(
                "content"
            )

            if not isinstance(
                content,
                str,
            ):
                raise ValueError(
                    "El mensaje system no "
                    "contiene texto válido."
                )

            content = (
                content.strip()
            )

            if not content:
                raise ValueError(
                    "El system prompt está vacío."
                )

            return content

        return None

    @staticmethod
    def parse_tool_response(
        content: str,
    ) -> dict[str, object]:
        """
        Convierte el resultado JSON generado por
        handle_tool_calls a un objeto estructurado.

        Gemini espera un objeto como respuesta de
        FunctionResponse, no una cadena JSON anidada.
        """

        try:
            parsed: object = (
                json.loads(
                    content
                )
            )

        except json.JSONDecodeError:
            # Si una futura tool retorna texto plano,
            # se conserva dentro de una propiedad result.
            return {
                "result": content,
            }

        if not isinstance(
            parsed,
            dict,
        ):
            return {
                "result": parsed,
            }

        return cast(
            dict[str, object],
            parsed,
        )

    def build_history(
        self,
        messages: list[ChatMessage],
    ) -> list[types.Content]:
        """
        Convierte el historial neutral al formato utilizado por Gemini.

        El system prompt no forma parte del historial conversacional.
        Se envía mediante GenerateContentConfig.system_instruction.

        Se retorna list[types.Content] en lugar de ContentOrDict porque
        todos los elementos creados por este adapter son objetos Content.
        Esto mantiene un tipo concreto y evita uniones innecesarias.
        """

        history: list[types.Content] = []

        for message in messages:
            role = normalize_chat_role(
                message["role"]
            )

            # Gemini recibe las instrucciones del sistema mediante
            # GenerateContentConfig.system_instruction.
            if role == "system":
                continue

            # -----------------------------------------------------------------
            # Resultado de una herramienta
            # -----------------------------------------------------------------

            if role == "tool":
                tool_name = message.get(
                    "name"
                )

                content = message.get(
                    "content"
                )

                if not isinstance(
                    tool_name,
                    str,
                ):
                    raise ValueError(
                        "El resultado de una tool "
                        "no contiene un nombre válido."
                    )

                if not isinstance(
                    content,
                    str,
                ):
                    raise ValueError(
                        "El resultado de la tool "
                        f"'{tool_name}' no contiene "
                        "contenido válido."
                    )

                tool_response = (
                    self.parse_tool_response(
                        content
                    )
                )

                history.append(
                    types.Content(
                        # Gemini representa la respuesta de una función
                        # mediante un Content con FunctionResponse.
                        role="tool",
                        parts=[
                            types.Part.from_function_response(
                                name=tool_name,
                                response=tool_response,
                            )
                        ],
                    )
                )

                continue

            # -----------------------------------------------------------------
            # Solicitud de herramientas realizada por el modelo
            # -----------------------------------------------------------------

            if role == "assistant":
                # ChatMessage define tool_calls como una propiedad opcional.
                #
                # No debe utilizarse:
                #
                #     message["tool_calls"]
                #
                # porque podría producir KeyError.
                tool_calls = message.get(
                    "tool_calls"
                )

                if tool_calls:
                    parts: list[
                        types.Part
                    ] = []

                    for tool_call in tool_calls:
                        function_raw = (
                            tool_call.get(
                                "function"
                            )
                        )

                        if not isinstance(
                            function_raw,
                            dict,
                        ):
                            raise ValueError(
                                "El historial contiene "
                                "una tool sin function."
                            )

                        function = cast(
                            dict[str, object],
                            function_raw,
                        )

                        name = function.get(
                            "name"
                        )

                        arguments = function.get(
                            "arguments"
                        )

                        if not isinstance(
                            name,
                            str,
                        ):
                            raise ValueError(
                                "El historial contiene "
                                "una tool sin nombre."
                            )

                        if not isinstance(
                            arguments,
                            dict,
                        ):
                            raise ValueError(
                                "Los argumentos de la "
                                f"tool '{name}' no son "
                                "un objeto válido."
                            )

                        normalized_arguments = cast(
                            dict[str, object],
                            arguments,
                        )

                        tool_call_id = (
                            tool_call.get(
                                "id"
                            )
                        )

                        thought_signature: (
                            bytes
                            | None
                        ) = None

                        if isinstance(
                            tool_call_id,
                            str,
                        ):
                            thought_signature = (
                                self
                                .get_thought_signature(
                                    tool_call_id
                                )
                            )

                        # Gemini 3 exige reenviar la firma opaca
                        # asociada al FunctionCall original.
                        #
                        # La firma permanece dentro del adapter
                        # y no modifica el contrato compartido.
                        if (
                            thought_signature
                            is not None
                        ):
                            parts.append(
                                types.Part(
                                    function_call=(
                                        types.FunctionCall(
                                            name=name,
                                            args=(
                                                normalized_arguments
                                            ),
                                        )
                                    ),
                                    thought_signature=(
                                        thought_signature
                                    ),
                                )
                            )

                            continue

                        # Los modelos que no utilizan firmas
                        # mantienen el comportamiento anterior.
                        parts.append(
                            types.Part.from_function_call(
                                name=name,
                                args=normalized_arguments,
                            )
                        )

                    if not parts:
                        raise ValueError(
                            "El mensaje assistant contiene "
                            "una lista de tool_calls vacía."
                        )

                    history.append(
                        types.Content(
                            role="model",
                            parts=parts,
                        )
                    )

                    continue

            # -----------------------------------------------------------------
            # Mensaje conversacional normal
            # -----------------------------------------------------------------

            content = message.get(
                "content"
            )

            if not isinstance(
                content,
                str,
            ):
                raise ValueError(
                    "El mensaje con role "
                    f"'{role}' no contiene "
                    "texto válido."
                )

            gemini_role = (
                "model"
                if role == "assistant"
                else "user"
            )

            history.append(
                types.Content(
                    role=gemini_role,
                    parts=[
                        types.Part.from_text(
                            text=content
                        )
                    ],
                )
            )

        return history


    def send_chat_message_with_retry(
        self,
        *,
        client: Client,
        model: str,
        history: list[ChatMessage],
        question: str | None = None,
        tools: Sequence[
            ToolDefinition
        ]
        | None = None,
        max_retries: int = 3,
    ) -> types.GenerateContentResponse:
        """
        Envía el historial completo a Gemini.

        No se crea un mensaje vacío.

        El historial neutral se convierte a list[types.Content]
        y se adapta al tipo de entrada esperado por generate_content()
        únicamente en la frontera con el SDK.
        """

        request_history = list(
            history
        )

        if question is not None:
            request_history.append(
                {
                    "role": "user",
                    "content": question,
                }
            )

        contents = self.build_history(
            request_history
        )

        if not contents:
            raise ValueError(
                "No existen mensajes para "
                "enviar a Gemini."
            )

        config = self.build_config(
            messages=request_history,
            tools=tools,
        )

        # El SDK acepta una lista de Content.
        #
        # Algunas versiones de sus type stubs no reconocen
        # correctamente list[Content] como ContentListUnionDict.
        #
        # El cast se mantiene únicamente en esta frontera.
        request_contents = cast(
            types.ContentListUnionDict,
            contents,
        )

        for attempt in range(
            1,
            max_retries + 1,
        ):
            try:
                return (
                    client
                    .models
                    .generate_content(
                        model=model,
                        contents=(
                            request_contents
                        ),
                        config=config,
                    )
                )

            except Exception as error:
                # Dependiendo de la excepción del SDK,
                # el código puede encontrarse en code
                # o status_code.
                code = getattr(
                    error,
                    "code",
                    None,
                )

                status_code = getattr(
                    error,
                    "status_code",
                    code,
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
                        "Gemini no respondió "
                        "después de "
                        f"{max_retries} intentos. "
                        "Último error: "
                        f"{status_code}"
                    ) from error

                wait_seconds = (
                    2**attempt
                )

                print(
                    "Gemini ocupado o con "
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
            "la consulta a Gemini."
        )


    @staticmethod
    def normalize_function_arguments(
        arguments: object,
    ) -> dict[str, object]:
        """
        Normaliza los argumentos devueltos por Gemini.

        FunctionCall.args debe representar un objeto.
        """

        if arguments is None:
            return {}

        if isinstance(
            arguments,
            dict,
        ):
            return cast(
                dict[str, object],
                arguments,
            )

        # Algunos objetos del SDK son convertibles
        # directamente a dict.
        try:
            converted = dict(
                cast(
                    Mapping[
                        str,
                        object,
                    ],
                    arguments,
                )
            )

        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                "Gemini devolvió argumentos "
                "de tool con un formato inválido."
            ) from error

        return converted

    def get_tool_calls(
        self,
        response: (
            types
            .GenerateContentResponse
        ),
    ) -> list[
        ToolCallDict
    ] | None:
        """
        Obtiene y normaliza los FunctionCall de Gemini.

        Los objetos específicos del SDK no salen del adapter.

        El resto de la aplicación recibe ToolCallDict,
        igual que otros adapters normalizados.
        """

        candidates = getattr(
            response,
            "candidates",
            None,
        )

        if not candidates:
            return None

        first_candidate = (
            candidates[0]
        )

        content = getattr(
            first_candidate,
            "content",
            None,
        )

        if content is None:
            return None

        parts = getattr(
            content,
            "parts",
            None,
        )

        if not parts:
            return None

        normalized_calls: list[
            ToolCallDict
        ] = []

        for index, part in enumerate(
            parts
        ):
            function_call = getattr(
                part,
                "function_call",
                None,
            )

            if function_call is None:
                continue

            name = getattr(
                function_call,
                "name",
                None,
            )

            arguments = getattr(
                function_call,
                "args",
                None,
            )

            function_call_id = (
                getattr(
                    function_call,
                    "id",
                    None,
                )
            )

            # Gemini 3 devuelve la firma en el Part,
            # no dentro del objeto FunctionCall.
            thought_signature = getattr(
                part,
                "thought_signature",
                None,
            )

            if not isinstance(
                name,
                str,
            ):
                raise ValueError(
                    "Gemini devolvió una "
                    "tool sin nombre."
                )

            name = name.strip()

            if not name:
                raise ValueError(
                    "Gemini devolvió una "
                    "tool con nombre vacío."
                )

            normalized_arguments = (
                self
                .normalize_function_arguments(
                    arguments
                )
            )

            # El id es opcional en Gemini.
            #
            # La aplicación necesita un identificador
            # neutral para relacionar el resultado.
            if not isinstance(
                function_call_id,
                str,
            ):
                function_call_id = (
                    "gemini_"
                    f"{name}_"
                    f"{index + 1}"
                )

            self.store_thought_signature(
                tool_call_id=(
                    function_call_id
                ),
                thought_signature=(
                    thought_signature
                ),
            )

            normalized_calls.append(
                {
                    "id": (
                        function_call_id
                    ),
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": (
                            normalized_arguments
                        ),
                    },
                }
            )

        return (
            normalized_calls
            if normalized_calls
            else None
        )

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[
            ChatMessage
        ],
        response: (
            types
            .GenerateContentResponse
        ),
        model: str,
    ) -> None:
        """
        Agrega al historial neutral las tools
        solicitadas por Gemini.

        No se almacenan objetos propios del SDK.
        """

        tool_calls = (
            self.get_tool_calls(
                response
            )
        )

        if not tool_calls:
            raise ValueError(
                "Gemini no devolvió "
                "tool calls."
            )

        messages.append(
            {
                "role": "assistant",
                "model": model,
                "content": None,
                "tool_calls": cast(
                    list[
                        dict[
                            str,
                            Any,
                        ]
                    ],
                    tool_calls,
                ),
            }
        )

    def get_response_text(
        self,
        response: (
            types
            .GenerateContentResponse
        ),
    ) -> str:
        """
        Obtiene y valida el texto generado por Gemini.
        """

        text = getattr(
            response,
            "text",
            None,
        )

        if text is None:
            raise ValueError(
                "Gemini no devolvió "
                "contenido de texto."
            )

        text = text.strip()

        if not text:
            raise ValueError(
                "Gemini devolvió "
                "una respuesta vacía."
            )

        return text

    @staticmethod
    def get_successful_tool_names(
        tool_results: list[
            ChatMessage
        ],
    ) -> list[str]:
        """
        Obtiene las tools cuyo resultado indicó:

            status = "ok"

        El adapter no interpreta el significado
        funcional de cada herramienta.
        """

        successful_names: list[
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
                parsed: object = (
                    json.loads(
                        content
                    )
                )

            except (
                json.JSONDecodeError
            ):
                continue

            if not isinstance(
                parsed,
                dict,
            ):
                continue

            payload = cast(
                dict[
                    str,
                    object,
                ],
                parsed,
            )

            status = (
                payload.get(
                    "status"
                )
            )

            if status != "ok":
                continue

            successful_names.append(
                name
            )

        return successful_names

    def ask_chat_question(
        self,
        *,
        client: Client,
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
        Ejecuta un turno completo de Gemini.

        El resultado cumple el mismo contrato
        utilizado por OpenAI:

        - content;
        - used_tools;
        - tool_names;
        - successful_tool_names;
        - tool_iterations.
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

            if not tool_calls:
                answer = (
                    self.get_response_text(
                        response
                    )
                )

                messages.append(
                    {
                        "role": (
                            "assistant"
                        ),
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

            if (
                handle_tool_calls
                is None
            ):
                raise RuntimeError(
                    "Gemini solicitó tools, "
                    "pero no se proporcionó "
                    "handle_tool_calls."
                )

            tool_iterations += 1

            # Se conserva la solicitud técnica
            # para enviarla nuevamente a Gemini
            # junto con los resultados.
            messages.append(
                {
                    "role": "assistant",
                    "model": model,
                    "content": None,
                    "tool_calls": cast(
                        list[
                            dict[
                                str,
                                Any,
                            ]
                        ],
                        tool_calls,
                    ),
                }
            )

            for tool_call in (
                tool_calls
            ):
                tool_name = (
                    tool_call[
                        "function"
                    ][
                        "name"
                    ]
                )

                if (
                    tool_name
                    not in tool_names
                ):
                    tool_names.append(
                        tool_name
                    )

            # La ejecución funcional permanece
            # fuera del adapter.
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
                    (
                        successful_tool_names
                        .append(
                            tool_name
                        )
                    )

        raise RuntimeError(
            "Se alcanzó el límite de "
            f"{max_tool_iterations} "
            "iteraciones de tools "
            "para Gemini."
        )