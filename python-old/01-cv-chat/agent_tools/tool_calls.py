import json
from typing import Callable, cast

from config.shared.types import (
    ChatMessage,
    NormalizedToolCall,
    ToolCall,
    ToolCallDict,
    ToolResponse,
)

from agent_tools.functions import (
    record_unknown_question,
    record_user_details,
    send_email_to_admin,
)


ToolArguments = dict[str, object]
ToolFunction = Callable[..., ToolResponse]


AVAILABLE_TOOLS: dict[str, ToolFunction] = {
    "record_user_details": record_user_details,
    "record_unknown_question": record_unknown_question,
    "send_email_to_admin": send_email_to_admin,
}


def is_tool_call_dict(tool_call: NormalizedToolCall) -> bool:
    return isinstance(tool_call, dict)


def get_tool_call_id(
    tool_call: NormalizedToolCall,
    index: int,
) -> str:
    if is_tool_call_dict(tool_call):
        dict_tool_call = cast(ToolCallDict, tool_call)
        return dict_tool_call["id"]

    openai_tool_call = cast(ToolCall, tool_call)
    return openai_tool_call.id


def get_tool_name(tool_call: NormalizedToolCall) -> str:
    if is_tool_call_dict(tool_call):
        dict_tool_call = cast(ToolCallDict, tool_call)
        return dict_tool_call["function"]["name"]

    openai_tool_call = cast(ToolCall, tool_call)
    return openai_tool_call.function.name


def get_tool_arguments(tool_call: NormalizedToolCall) -> ToolArguments:
    if is_tool_call_dict(tool_call):
        dict_tool_call = cast(ToolCallDict, tool_call)
        raw_arguments = dict_tool_call["function"]["arguments"]

        if isinstance(raw_arguments, str):
            parsed_raw: object = json.loads(raw_arguments)

            if not isinstance(parsed_raw, dict):
                raise ValueError(
                    "Los argumentos de la herramienta no son un objeto JSON."
                )

            return cast(ToolArguments, parsed_raw)

        return raw_arguments

    openai_tool_call = cast(ToolCall, tool_call)

    parsed_raw: object = json.loads(openai_tool_call.function.arguments)

    if not isinstance(parsed_raw, dict):
        raise ValueError("Los argumentos de la herramienta no son un objeto JSON.")

    return cast(ToolArguments, parsed_raw)


def build_blocked_tool_response(
    tool_name: str,
    tool_call_id: str,
) -> ChatMessage:
    response: ToolResponse = {
        "action": "blocked",
        "status": "error",
        "message": (
            f"La herramienta '{tool_name}' no está permitida en este flujo."
        ),
    }

    return {
        "role": "tool",
        "name": tool_name,
        "content": json.dumps(response, ensure_ascii=False),
        "tool_call_id": tool_call_id,
    }

def execute_tool_call(
    tool_name: str,
    arguments: ToolArguments,
    tool_call_id: str,
) -> ChatMessage:
    tool = AVAILABLE_TOOLS.get(tool_name)

    if tool is None:
        return build_blocked_tool_response(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
        )

    response = tool(**arguments)

    return {
        "role": "tool",
        "name": tool_name,
        "content": json.dumps(response, ensure_ascii=False),
        "tool_call_id": tool_call_id,
    }


def handle_tool_calls(
    tool_calls: list[NormalizedToolCall],
) -> list[ChatMessage]:
    results: list[ChatMessage] = []

    for index, tool_call in enumerate(tool_calls):
        tool_name = get_tool_name(tool_call)
        tool_call_id = get_tool_call_id(tool_call, index)
        arguments = get_tool_arguments(tool_call)

        results.append(
            execute_tool_call(
                tool_name=tool_name,
                arguments=arguments,
                tool_call_id=tool_call_id,
            )
        )

    return results