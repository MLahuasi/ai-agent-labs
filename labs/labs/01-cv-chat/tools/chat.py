from typing import Any, Sequence
from pathlib import Path

from config.shared.llm_client import HandleToolCalls, ToolDefinition
from config.shared.question import AskChatQuestion
from config.shared.types import ChatMessage
from tools.response import evaluate_response, rerun_response
from tools.history import save_history


def last_response_used_tool(history: list[ChatMessage]) -> bool:
    recent_messages = history[-4:]

    return any(
        item.get("role") == "tool" or "tool_calls" in item
        for item in recent_messages
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

        history[-1] = {
            "role": "assistant",
            "model": model,
            "content": reply,
        }

    save_history(
        history=history,
        data_dir=data_dir,
        history_file=history_file,
    )

    return reply