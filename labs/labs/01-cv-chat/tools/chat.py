#  Usar el prompt RAG durante el turno sin contaminar el historial
from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

from config.shared.llm_client import (
    HandleToolCalls,
    ToolDefinition,
)
from config.shared.question import AskChatQuestion
from config.shared.types import ChatMessage

from tools.history import save_history
from tools.response import evaluate_response, rerun_response


def last_response_used_tool(history: list[ChatMessage]) -> bool:
    """Determina si el turno actual ejecutó alguna tool."""
    recent_messages = history[-6:]

    return any(
        item.get("role") == "tool" or bool(item.get("tool_calls"))
        for item in recent_messages
    )


def remove_last_tool_interaction(
    history: list[ChatMessage],
) -> None:
    """
    Elimina la información técnica de tool calling.

    Se conservan únicamente los mensajes visibles para el usuario.
    """

    cleaned_history: list[ChatMessage] = []

    for item in history:
        role = item.get("role")

        if role == "tool":
            continue

        if role == "assistant" and item.get("tool_calls"):
            continue

        content = item.get("content")

        if role == "assistant" and content is None:
            continue

        cleaned_history.append(item)

    history.clear()
    history.extend(cleaned_history)


def replace_last_assistant_message(
    history: list[ChatMessage],
    *,
    model: str,
    reply: str,
) -> None:
    """Reemplaza la respuesta rechazada por la respuesta corregida."""
    for index in range(len(history) - 1, -1, -1):
        item = history[index]

        if (
            item.get("role") == "assistant"
            and not item.get("tool_calls")
        ):
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

def replace_system_prompt(
    history: list[ChatMessage],
    system_prompt: str,
) -> str:
    """
    Reemplaza temporalmente el prompt base por el prompt del turno.

    El nuevo prompt contiene únicamente el contexto recuperado
    para la consulta actual.
    """

    if not history:
        raise ValueError("El historial no contiene system prompt.")

    if history[0].get("role") != "system":
        raise ValueError(
            "El primer mensaje del historial debe tener role='system'."
        )

    original_system_prompt = history[0].get("content")

    if not isinstance(original_system_prompt, str):
        raise ValueError("El system prompt almacenado no es válido.")

    history[0]["content"] = system_prompt

    return original_system_prompt

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
    """
    Ejecuta el flujo existente usando el contexto RAG del turno.

    Las tools se mantienen sin cambios.
    El system prompt dinámico se restaura antes de persistir
    el historial para no almacenar fragmentos recuperados.
    """
    original_system_prompt = replace_system_prompt(
        history,
        system_prompt,
    )

    try:
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
            print(
                "Respuesta generada después de ejecutar tool. "
                "Se omite evaluación."
            )

            remove_last_tool_interaction(history)

            return reply
        
        evaluation = evaluate_response(
            ask_chat_question=ask_chat_question,
            client=client,
            model=model,
            evaluator_prompt=evaluator_prompt,
            reply=reply,
            message=message,
            history=history
        )

        print(
            f"Evaluación: acceptable: "
            f"{evaluation.is_acceptable} "
            f"- feedback: {evaluation.feedback}"
        )

        if evaluation.is_acceptable:
            print("Evaluación aprobada.")

            return reply

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

        return reply
    
    finally:
        # El historial conserva un prompt estable.
        # Los fragmentos RAG no se almacenan entre conversaciones.
        history[0]["content"] = original_system_prompt

        save_history(
            history=history,
            data_dir=data_dir,
            history_file=history_file,
        )