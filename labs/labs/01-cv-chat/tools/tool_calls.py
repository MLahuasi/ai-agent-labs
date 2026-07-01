import json
from typing import Any, cast

from config.shared.types import ChatMessage


def create_handle_tool_calls(tool_registry: dict[str, Any]):
    def handle_tool_calls(tool_calls: Any) -> list[ChatMessage]:
        results: list[ChatMessage] = []

        for index, tool_call in enumerate(tool_calls):
            if isinstance(tool_call, dict):
                tool_call_data = cast(dict[str, Any], tool_call)

                function_data = cast(
                    dict[str, Any],
                    tool_call_data.get("function", {}),
                )

                tool_name = str(function_data.get("name", ""))
                raw_arguments = str(function_data.get("arguments", "{}"))
                tool_call_id = str(
                    tool_call_data.get("id", f"tool_call_{index}")
                )

                arguments = json.loads(raw_arguments)

            else:
                function = getattr(tool_call, "function", None)

                if function is not None:
                    tool_name = str(function.name)
                    raw_arguments = str(function.arguments)
                    tool_call_id = str(
                        getattr(tool_call, "id", f"tool_call_{index}")
                    )

                    arguments = json.loads(raw_arguments)

                else:
                    tool_name = str(getattr(tool_call, "name", ""))
                    arguments = getattr(tool_call, "args", {}) or {}
                    tool_call_id = str(
                        getattr(
                            tool_call,
                            "id",
                            tool_name or f"tool_call_{index}",
                        )
                    )

            tool = tool_registry.get(tool_name)

            if tool is None:
                result = {
                    "error": f"Herramienta no registrada: {tool_name}",
                }
            else:
                result = tool(**arguments)

            results.append(
                {
                    "role": "tool",
                    "name": tool_name,
                    "content": json.dumps(result, ensure_ascii=False),
                    "tool_call_id": tool_call_id,
                }
            )

        return results

    return handle_tool_calls