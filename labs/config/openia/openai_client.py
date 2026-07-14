import json
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
sys.path.insert(0, str(LABS_DIR))


from config.openia.config import (
    RETRYABLE_STATUS_CODES,
    load_openai_api_key,
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
    ChatTurnResult,
)


class OpenAILlmClientAdapter(LlmClientAdapter):
    """
    Adapter para OpenAI.

    Responsabilidades:

    - crear el cliente OpenAI;
    - convertir el historial neutral al formato del SDK;
    - ejecutar chat y embeddings;
    - aplicar reintentos técnicos;
    - normalizar respuestas;
    - administrar el protocolo técnico de tool calling.

    No contiene reglas del chatbot ni conoce qué respuesta debe mostrarse
    después de una herramienta concreta.
    """

    def create_client(self) -> OpenAI:
        load_openai_api_key()
        return OpenAI()

    def create_embeddings(
        self,
        *,
        client: OpenAI,
        model: str,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Genera embeddings utilizando OpenAI.

        La respuesta específica del SDK se transforma al contrato neutral
        esperado por el resto de la aplicación.
        """

        if not texts:
            return []

        response = client.embeddings.create(
            model=model,
            input=texts,
            encoding_format="float",
        )

        # OpenAI incluye el índice original de cada entrada.
        # Se ordenan los resultados para conservar exactamente la misma
        # posición que tenían los textos recibidos.
        ordered_embeddings = sorted(
            response.data,
            key=lambda item: item.index,
        )

        return [
            item.embedding
            for item in ordered_embeddings
        ]

    def get_tool_calls(
        self,
        response: ChatCompletion,
    ) -> Any | None:
        """
        Extrae los tool calls devueltos por OpenAI.

        Se retorna None cuando la respuesta no contiene opciones.
        """

        if not response.choices:
            return None

        message = response.choices[0].message

        return getattr(
            message,
            "tool_calls",
            None,
        )

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[ChatMessage],
        response: ChatCompletion,
        model: str,
    ) -> None:
        """
        Convierte el mensaje assistant con tool calls a una estructura
        serializable y neutral.

        Los objetos Pydantic del SDK no deben escapar del adapter.
        """

        message = response.choices[0].message
        tool_calls = message.tool_calls or []

        serializable_tool_calls: list[dict[str, Any]] = []

        for tool_call in tool_calls:
            if hasattr(tool_call, "model_dump"):
                serializable_tool_calls.append(
                    tool_call.model_dump(
                        exclude_none=True,
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
                "content": message.content,
                "tool_calls": serializable_tool_calls,
            }
        )

    def build_history(
        self,
        messages: list[ChatMessage],
    ) -> list[ChatCompletionMessageParam]:
        """
        Convierte el historial neutral al formato de OpenAI.

        También valida las invariantes requeridas por el protocolo:

        assistant con tool_calls
            ↓
        uno o más mensajes role="tool"

        No se envía un historial incompleto al proveedor.
        """

        history: list[ChatCompletionMessageParam] = []

        pending_tool_call_ids: list[str] = []

        for message in messages:
            role = normalize_chat_role(
                message["role"]
            )

            # Cuando existen tools pendientes, el siguiente mensaje debe
            # contener obligatoriamente un resultado role="tool".
            if pending_tool_call_ids and role != "tool":
                raise ValueError(
                    "Historial inválido: un mensaje assistant con "
                    "tool_calls debe estar seguido inmediatamente por "
                    "mensajes role='tool'. "
                    f"Tool calls pendientes: {pending_tool_call_ids}"
                )

            payload: dict[str, Any] = {
                "role": role,
                "content": message.get("content"),
            }

            if role == "tool":
                tool_call_id = message.get(
                    "tool_call_id"
                )

                if tool_call_id is None:
                    raise ValueError(
                        "El mensaje con role='tool' "
                        "no tiene tool_call_id."
                    )

                payload["tool_call_id"] = (
                    tool_call_id
                )

                if tool_call_id in pending_tool_call_ids:
                    pending_tool_call_ids.remove(
                        tool_call_id
                    )

            if role == "assistant":
                tool_calls = message.get(
                    "tool_calls"
                )

                if tool_calls:
                    payload["tool_calls"] = tool_calls

                    pending_tool_call_ids = []

                    for tool_call in tool_calls:
                        tool_call_id = tool_call.get(
                            "id"
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
                            "El mensaje assistant tiene "
                            "tool_calls, pero no se pudieron "
                            "obtener sus ids."
                        )

            history.append(
                cast(
                    ChatCompletionMessageParam,
                    payload,
                )
            )

        if pending_tool_call_ids:
            raise ValueError(
                "Historial inválido: quedaron tool_calls "
                "sin respuesta tool. "
                f"Tool calls pendientes: {pending_tool_call_ids}"
            )

        return history

    def send_chat_message_with_retry(
        self,
        *,
        client: OpenAI,
        model: str,
        history: list[ChatMessage],
        question: str | None = None,
        tools: Sequence[ToolDefinition] | None = None,
        max_retries: int = 3,
    ) -> ChatCompletion:
        """
        Envía una solicitud a OpenAI.

        Solo reintenta errores técnicos configurados como temporales.
        Los errores funcionales o de programación se propagan
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

        for attempt in range(
            1,
            max_retries + 1,
        ):
            try:
                if tools is None:
                    return (
                        client.chat.completions.create(
                            model=model,
                            messages=messages,
                        )
                    )

                return client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=cast(
                        Any,
                        tools,
                    ),
                )

            except Exception as error:
                status_code = getattr(
                    error,
                    "status_code",
                    None,
                )

                if (
                    status_code
                    not in RETRYABLE_STATUS_CODES
                ):
                    raise

                if attempt == max_retries:
                    raise RuntimeError(
                        "OpenAI no respondió después de "
                        f"{max_retries} intentos. "
                        f"Último error: {status_code}"
                    ) from error

                wait_seconds = 2**attempt

                print(
                    "OpenAI ocupado o con error temporal "
                    f"[{status_code}]. "
                    f"Reintentando en {wait_seconds}s..."
                )

                time.sleep(
                    wait_seconds
                )

        # Salvaguarda para el analizador de tipos.
        # El flujo normal siempre retorna o genera una excepción.
        raise RuntimeError(
            "No se pudo completar la consulta a OpenAI."
        )

    def get_response_text(
        self,
        response: ChatCompletion,
    ) -> str:
        """
        Obtiene y valida la respuesta textual de OpenAI.
        """

        if not response.choices:
            raise ValueError(
                "OpenAI no devolvió opciones de respuesta."
            )

        text = (
            response
            .choices[0]
            .message
            .content
        )

        if text is None:
            raise ValueError(
                "OpenAI no devolvió contenido de texto."
            )

        text = text.strip()

        if not text:
            raise ValueError(
                "OpenAI devolvió una respuesta vacía."
            )

        return text

    @staticmethod
    def _get_tool_name(
        tool_call: Any,
    ) -> str | None:
        """
        Obtiene el nombre de una tool desde el objeto del SDK.

        La extracción permanece dentro del adapter porque depende
        de la estructura específica de OpenAI.
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

        if not isinstance(name, str):
            return None

        name = name.strip()

        return name or None

    @staticmethod
    def _get_successful_tool_names(
        tool_results: list[ChatMessage],
    ) -> list[str]:
        """
        Obtiene las tools cuyo resultado informó status="ok".

        json.loads() produce datos externos sin un tipo estático
        confiable. La estructura se valida antes de utilizar .get().
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
                # El resultado se mantiene como object hasta
                # comprobar su estructura.
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

            # Después de validar que es un diccionario,
            # definimos explícitamente sus tipos.
            #
            # Esto elimina el error:
            # "El tipo de get es parcialmente desconocido".
            payload = cast(
                dict[str, object],
                parsed_content,
            )

            status = payload.get(
                "status"
            )

            if status != "ok":
                continue

            successful_tool_names.append(
                name
            )

        return successful_tool_names    

    def ask_chat_question(
        self,
        *,
        client: OpenAI,
        model: str,
        messages: list[ChatMessage],
        role: ChatRole,
        question: str,
        tools: Sequence[ToolDefinition] | None = None,
        handle_tool_calls: HandleToolCalls | None = None,
        max_tool_iterations: int = 5,
    ) -> ChatTurnResult:
        """
        Ejecuta un turno completo de conversación.

        Diferencia respecto a la implementación anterior:

        Antes:
            retornaba únicamente str.

        Ahora:
            retorna ChatTurnResult con información explícita sobre tools.

        Esto evita que la lógica común tenga que deducir el uso de
        herramientas inspeccionando posiciones recientes del historial.
        """

        messages.append(
            {
                "role": role,
                "content": question,
            }
        )

        tool_names: list[str] = []

        successful_tool_names: list[str] = []

        tool_iterations = 0

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

            tool_calls = self.get_tool_calls(
                response
            )

            # Cuando no hay tools, la respuesta corresponde
            # al texto final del turno.
            if not tool_calls:
                answer = self.get_response_text(
                    response
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
                    "used_tools": bool(tool_names),
                    "tool_names": tool_names,
                    "successful_tool_names": (
                        successful_tool_names
                    ),
                    "tool_iterations": tool_iterations,
                }

            if handle_tool_calls is None:
                raise RuntimeError(
                    "El modelo solicitó tool calls, "
                    "pero no se proporcionó "
                    "handle_tool_calls."
                )

            tool_iterations += 1

            # Conserva la solicitud original en el historial técnico.
            self.append_assistant_tool_call_message(
                messages=messages,
                response=response,
                model=model,
            )

            # Registra los nombres solicitados por el modelo.
            for tool_call in tool_calls:
                tool_name = self._get_tool_name(
                    tool_call
                )

                if (
                    tool_name is not None
                    and tool_name not in tool_names
                ):
                    tool_names.append(
                        tool_name
                    )

            # La ejecución real continúa fuera del adapter.
            # El adapter no conoce AVAILABLE_TOOLS ni funciones de negocio.
            tool_results = handle_tool_calls(
                tool_calls
            )

            messages.extend(
                tool_results
            )

            current_successful_names = (
                self._get_successful_tool_names(
                    tool_results
                )
            )

            for tool_name in (
                current_successful_names
            ):
                if (
                    tool_name
                    not in successful_tool_names
                ):
                    successful_tool_names.append(
                        tool_name
                    )

        raise RuntimeError(
            "Se alcanzó el límite de "
            f"{max_tool_iterations} "
            "iteraciones de tools."
        )