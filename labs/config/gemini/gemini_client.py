import sys
import time
from pathlib import Path
from typing import Any, Mapping, Sequence, cast

from google import genai
from google.genai import Client, types

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.gemini.config import (
    GEMINI_GENERATION_CONFIG,
    RETRYABLE_STATUS_CODES,
    load_gemini_api_key,
)
from config.shared.llm_client import (
    HandleToolCalls,
    LlmClientAdapter,
    ToolDefinition,
)
from config.shared.roles import normalize_chat_role
from config.shared.types import ChatMessage, ChatRole



class GeminiLlmClientAdapter(LlmClientAdapter):
    def create_client(self) -> Client:
        load_gemini_api_key()
        return genai.Client()

    def build_gemini_tools(
        self,
        tools: Sequence[ToolDefinition] | None,
    ) -> list[types.Tool] | None:
        if not tools:
            return None

        function_declarations: list[types.FunctionDeclaration] = []

        for tool in tools:
            tool_dict = cast(dict[str, Any], tool)

            # Formato OpenAI:
            # {
            #   "type": "function",
            #   "function": {
            #       "name": "...",
            #       "description": "...",
            #       "parameters": {...}
            #   }
            # }
            
            # function_def = tool_dict.get("function")
            function_def_raw = tool_dict.get("function")

            # if not isinstance(function_def, dict):
            if not isinstance(function_def_raw, dict):
                continue

            function_def = cast(Mapping[str, Any], function_def_raw)
            
            name_raw = function_def.get("name")
            description_raw = function_def.get("description", "")
            parameters = function_def.get("parameters")

            if not isinstance(name_raw, str):
                continue

            name = name_raw
            description = description_raw if isinstance(description_raw, str) else ""

            function_declarations.append(
                types.FunctionDeclaration(
                    name=name,
                    description=str(description),
                    parameters_json_schema=parameters,
                )
            )

        if not function_declarations:
            return None

        return [
            types.Tool(
                function_declarations=function_declarations,
            )
        ]

    def get_tool_calls(self, response: types.GenerateContentResponse) -> Any | None:
        candidates = getattr(response, "candidates", None)

        if not candidates:
            return None

        first_candidate = candidates[0]
        content = getattr(first_candidate, "content", None)

        if content is None:
            return None

        parts = getattr(content, "parts", None)

        if not parts:
            return None

        function_calls: list[Any] = []

        for part in parts:
            function_call = getattr(part, "function_call", None)

            if function_call is not None:
                function_calls.append(function_call)

        if not function_calls:
            return None

        return function_calls

    def append_assistant_tool_call_message(
        self,
        *,
        messages: list[ChatMessage],
        response: types.GenerateContentResponse,
        model: str,
    ) -> None:
        tool_calls = self.get_tool_calls(response)

        if not tool_calls:
            raise ValueError("Gemini no devolvió tool calls en la respuesta.")

        messages.append(
            {
                "role": "assistant",
                "model": model,
                "content": "",
                "tool_calls": tool_calls,
            }
        )

    def build_history(self, messages: list[ChatMessage]) -> list[types.ContentOrDict]:
        history: list[types.ContentOrDict] = []

        for message in messages:
            role = normalize_chat_role(message["role"])
            content = message.get("content") or ""

            if role == "assistant":
                gemini_role = "model"
            else:
                gemini_role = "user"

            if role == "tool":
                tool_name = message.get("name")

                if tool_name is None:
                    tool_name = message.get("tool_call_id", "tool_result")

                history.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=str(tool_name),
                                response={
                                    "result": content,
                                },
                            )
                        ],
                    )
                )
                continue

            if role == "assistant" and "tool_calls" in message:
                parts: list[types.Part] = []

                for tool_call in message["tool_calls"]:
                    tool_name = getattr(tool_call, "name", None)
                    tool_args = getattr(tool_call, "args", None)

                    if tool_name is None:
                        continue

                    parts.append(
                        types.Part.from_function_call(
                            name=tool_name,
                            args=tool_args or {},
                        )
                    )

                if parts:
                    history.append(
                        types.Content(
                            role="model",
                            parts=parts,
                        )
                    )

                continue

            history.append(
                types.Content(
                    role=gemini_role,
                    parts=[types.Part(text=content)],
                )
            )

        return history

    # def build_config(
    #     self,
    #     tools: Sequence[ToolDefinition] | None = None,
    # ) -> types.GenerateContentConfig:
    #     if tools is None:
    #         return GEMINI_GENERATION_CONFIG

    #     base_config = cast(Any, GEMINI_GENERATION_CONFIG).model_dump(
    #         exclude_none=True
    #     )
    #     base_config["tools"] = cast(Any, tools)

    #     return types.GenerateContentConfig(**base_config)

    def build_config(
        self,
        tools: Sequence[ToolDefinition] | None = None,
    ) -> types.GenerateContentConfig:
        base_config = cast(Any, GEMINI_GENERATION_CONFIG).model_dump(
            exclude_none=True
        )

        gemini_tools = self.build_gemini_tools(tools)

        if gemini_tools is not None:
            base_config["tools"] = gemini_tools

        return types.GenerateContentConfig(**base_config)    

    def send_chat_message_with_retry(
        self,
        *,
        client: Client,
        model: str,
        history: list[ChatMessage],
        question: str | None = None,
        tools: Sequence[ToolDefinition] | None = None,
        max_retries: int = 3,
    ) -> types.GenerateContentResponse:
        gemini_history = self.build_history(history)

        for attempt in range(1, max_retries + 1):
            try:
                chat = client.chats.create(
                    model=model,
                    config=self.build_config(tools),
                    history=gemini_history,
                )

                if question is None:
                    return chat.send_message("")  # pyright: ignore[reportUnknownMemberType]

                return chat.send_message(question)  # pyright: ignore[reportUnknownMemberType]

            except Exception as error:
                status_code = getattr(error, "code", None)

                if status_code not in RETRYABLE_STATUS_CODES:
                    raise

                if attempt == max_retries:
                    raise RuntimeError(
                        f"Gemini no respondió después de {max_retries} intentos. "
                        f"Último error: {status_code}"
                    ) from error

                wait_seconds = 2**attempt
                print(
                    f"Gemini ocupado o con error temporal [{status_code}]. "
                    f"Reintentando en {wait_seconds}s..."
                )
                time.sleep(wait_seconds)

        raise RuntimeError("No se pudo completar la consulta a Gemini.")

    def get_response_text(self, response: types.GenerateContentResponse) -> str:
        text = getattr(response, "text", None)

        if text is None:
            raise ValueError("Gemini no devolvió contenido de texto.")

        text = text.strip()

        if not text:
            raise ValueError("Gemini devolvió una respuesta vacía.")

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