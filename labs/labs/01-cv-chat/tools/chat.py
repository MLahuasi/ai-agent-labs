from typing import Any, Sequence
from pathlib import Path

from config.shared.llm_client import HandleToolCalls, ToolDefinition
from config.shared.question import AskChatQuestion
from config.shared.types import ChatMessage
from tools.response import evaluate_response, rerun_response
from tools.history import save_history


def last_response_used_tool(history: list[ChatMessage]) -> bool:
    recent_messages = history[-6:]

    return any(
        item.get("role") == "tool" or bool(item.get("tool_calls"))
        for item in recent_messages
    )


def remove_last_tool_interaction(
    history: list[ChatMessage],
) -> None:
    """
    Elimina del historial la interacción técnica de tools generada en el último turno.

    Conserva el mensaje user y la respuesta final visible del assistant.
    Elimina:
    - assistant con tool_calls;
    - tool messages;
    - assistant con content=None.
    """
    if not history:
        return

    cleaned: list[ChatMessage] = []

    for item in history:
        role = item.get("role")

        if role == "tool":
            continue

        if role == "assistant" and item.get("tool_calls"):
            continue

        content = item.get("content")

        if role == "assistant" and content is None:
            continue

        cleaned.append(item)

    history.clear()
    history.extend(cleaned)


def replace_last_assistant_message(
    history: list[ChatMessage],
    *,
    model: str,
    reply: str,
) -> None:
    """
    Reemplaza la última respuesta visible del assistant.

    Si no existe una respuesta assistant textual al final, la agrega.
    """
    for index in range(len(history) - 1, -1, -1):
        item = history[index]

        if item.get("role") == "assistant" and not item.get("tool_calls"):
            history[index] = {
                "role": "assistant",
                "model": model,
                "content": reply,
            }
            return

    history.append(
        {
            "role": "assistant",
            "model": model,
            "content": reply,
        }
    )


def chat(
    ask_chat_question: AskChatQuestion,
    client: Any,
    model: str,
    system_prompt: str,
    evaluator_prompt: str,
    history: list[ChatMessage],
    data_dir: Path,
    history_file: Path,
    message: str,
    _gradio_history: list[dict[str, Any]],
    tools: Sequence[ToolDefinition] | None = None,
    handle_tool_calls: HandleToolCalls | None = None,
) -> str:
    reply = ask_chat_question(
        client=client,
        model=model,
        messages=history,
        role="user",
        question=message,
        tools=tools,
        handle_tool_calls=handle_tool_calls,
    )

    if last_response_used_tool(history):
        print("Respuesta generada después de ejecutar tool. Se omite evaluación.")

        remove_last_tool_interaction(history)

        save_history(
            history=history,
            data_dir=data_dir,
            history_file=history_file,
        )

        return reply

    evaluation = evaluate_response(
        ask_chat_question=ask_chat_question,
        client=client,
        model=model,
        evaluator_prompt=evaluator_prompt,
        reply=reply,
        message=message,
        history=history,
    )

    print(
        f"Evaluación: acceptable: {evaluation.is_acceptable} "
        f"- feedback: {evaluation.feedback}"
    )

    if evaluation.is_acceptable:
        print("Evaluación aprobada.")
    else:
        print("Evaluación rechazada.")
        print(evaluation.feedback)
        print(f"Reintentando respuesta con modelo {model}...")

        reply = rerun_response(
            client=client,
            ask_chat_question=ask_chat_question,
            model=model,
            system_prompt=system_prompt,
            history=history,
            message=message,
            previous_reply=reply,
            feedback=evaluation.feedback,
        )

        replace_last_assistant_message(
            history=history,
            model=model,
            reply=reply,
        )

    save_history(
        history=history,
        data_dir=data_dir,
        history_file=history_file,
    )

    return reply