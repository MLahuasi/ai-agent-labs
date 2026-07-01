import json
from typing import Any, Callable

from agent_tools.functions import (
    record_unknown_question,
    record_user_details,
    send_email_to_admin,
)


ToolFunction = Callable[..., dict[str, str]]


AVAILABLE_TOOLS: dict[str, ToolFunction] = {
    "record_user_details": record_user_details,
    "record_unknown_question": record_unknown_question,
    "send_email_to_admin": send_email_to_admin,
}

def handle_tool_calls(tool_calls: Any) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    for tool_call in tool_calls:
        tool_name = tool_call.function.name
        raw_arguments = tool_call.function.arguments

        arguments = json.loads(raw_arguments)

        tool = AVAILABLE_TOOLS.get(tool_name)

        if tool is None:
            result = {
                "error": f"Herramienta no permitida: {tool_name}",
            }
        else:
            result = tool(**arguments)

        results.append(
            {
                "role": "tool",
                "content": json.dumps(result, ensure_ascii=False),
                "tool_call_id": tool_call.id,
            }
        )

    return results