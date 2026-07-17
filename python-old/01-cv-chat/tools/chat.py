from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

from config.shared.llm_client import (
    HandleToolCalls,
)
from config.shared.question import (
    AskChatQuestion,
)
from config.shared.types import (
    ChatMessage,
    ChatTurnResult,
    ToolDefinition,
)

from prompts.system import (
    CONTACT_SUCCESS_RESPONSE,
    UNKNOWN_QUESTION_RESPONSE,
)

from tools.history import (
    save_history,
)

from tools.response import (
    evaluate_response,
    rerun_response,
)


def resolve_post_tool_response(
    turn_result: ChatTurnResult,
) -> str:
    """
    Aplica respuestas contractuales después de herramientas exitosas.

    Esta lógica pertenece al chatbot y no a los adapters porque conoce
    herramientas específicas del dominio.

    El adapter solamente informa:
    - herramientas solicitadas;
    - herramientas ejecutadas correctamente.
    """

    successful_tools = set(
        turn_result[
            "successful_tool_names"
        ]
    )

    # Mantiene la prioridad definida por las reglas
    # del chatbot.
    if (
        "record_user_details"
        in successful_tools
    ):
        return (
            CONTACT_SUCCESS_RESPONSE
        )

    if (
        "record_unknown_question"
        in successful_tools
    ):
        return (
            UNKNOWN_QUESTION_RESPONSE
        )

    # Las herramientas que no tengan una respuesta contractual
    # conservan el texto generado por el modelo.
    return turn_result[
        "content"
    ]


def remove_last_tool_interaction(
    history: list[ChatMessage],
) -> None:
    """
    Elimina mensajes técnicos de tool calling.

    El historial persistido conserva únicamente la conversación
    visible para el usuario.
    """

    cleaned_history: list[
        ChatMessage
    ] = []

    for item in history:
        role = item.get(
            "role"
        )

        if role == "tool":
            continue

        if (
            role == "assistant"
            and item.get(
                "tool_calls"
            )
        ):
            continue

        content = item.get(
            "content"
        )

        if (
            role == "assistant"
            and content is None
        ):
            continue

        cleaned_history.append(
            item
        )

    history.clear()

    history.extend(
        cleaned_history
    )


def replace_last_assistant_message(
    history: list[ChatMessage],
    *,
    model: str,
    reply: str,
) -> None:
    """
    Reemplaza la última respuesta visible del asistente.

    Se utiliza después de:
    - aplicar respuestas contractuales;
    - regenerar una respuesta rechazada.
    """

    for index in range(
        len(history) - 1,
        -1,
        -1,
    ):
        item = history[index]

        if (
            item.get("role")
            == "assistant"
            and not item.get(
                "tool_calls"
            )
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
    Reemplaza temporalmente el prompt base por el prompt RAG
    correspondiente al turno actual.
    """

    if not history:
        raise ValueError(
            "El historial no contiene "
            "un system prompt."
        )

    if (
        history[0].get(
            "role"
        )
        != "system"
    ):
        raise ValueError(
            "El primer mensaje del historial "
            "debe tener role='system'."
        )

    original_system_prompt = (
        history[0].get(
            "content"
        )
    )

    if not isinstance(
        original_system_prompt,
        str,
    ):
        raise ValueError(
            "El system prompt almacenado "
            "no es válido."
        )

    history[0]["content"] = (
        system_prompt
    )

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
    _gradio_history: list[
        dict[str, Any]
    ],
    tools: Sequence[
        ToolDefinition
    ]
    | None = None,
    handle_tool_calls: (
        HandleToolCalls
        | None
    ) = None,
) -> str:
    """
    Ejecuta el flujo conversacional.

    Todos los adapters retornan ChatTurnResult.

    No existe detección legacy mediante inspección del historial.
    """

    original_system_prompt = (
        replace_system_prompt(
            history,
            system_prompt,
        )
    )

    try:
        turn_result = (
            ask_chat_question(
                client=client,
                model=model,
                messages=history,
                role="user",
                question=message,
                tools=tools,
                handle_tool_calls=(
                    handle_tool_calls
                ),
            )
        )

        reply = turn_result[
            "content"
        ]

        if turn_result[
            "used_tools"
        ]:
            reply = (
                resolve_post_tool_response(
                    turn_result
                )
            )

            replace_last_assistant_message(
                history=history,
                model=model,
                reply=reply,
            )

            if turn_result[
                "tool_names"
            ]:
                print(
                    "Tools solicitadas: "
                    + ", ".join(
                        turn_result[
                            "tool_names"
                        ]
                    )
                )

            if turn_result[
                "successful_tool_names"
            ]:
                print(
                    "Tools ejecutadas "
                    "correctamente: "
                    + ", ".join(
                        turn_result[
                            "successful_tool_names"
                        ]
                    )
                )

            print(
                "Iteraciones de tools: "
                f"{turn_result['tool_iterations']}"
            )

            print(
                "Respuesta generada después "
                "de ejecutar tool. "
                "Se omite evaluación."
            )

            remove_last_tool_interaction(
                history
            )

            return reply

        evaluation = (
            evaluate_response(
                ask_chat_question=(
                    ask_chat_question
                ),
                client=client,
                model=model,
                evaluator_prompt=(
                    evaluator_prompt
                ),
                reply=reply,
                message=message,
                history=history,
            )
        )

        print(
            "Evaluación: acceptable: "
            f"{evaluation.is_acceptable} "
            "- feedback: "
            f"{evaluation.feedback}"
        )

        if evaluation.is_acceptable:
            print(
                "Evaluación aprobada."
            )

            return reply

        print(
            "Evaluación rechazada."
        )

        print(
            evaluation.feedback
        )

        print(
            "Reintentando respuesta "
            f"con modelo {model}..."
        )

        reply = rerun_response(
            client=client,
            ask_chat_question=(
                ask_chat_question
            ),
            model=model,
            system_prompt=(
                system_prompt
            ),
            history=history,
            message=message,
            previous_reply=reply,
            feedback=(
                evaluation.feedback
            ),
        )

        replace_last_assistant_message(
            history=history,
            model=model,
            reply=reply,
        )

        return reply

    finally:
        # Los fragmentos RAG del turno no se conservan
        # en el historial persistido.
        history[0]["content"] = (
            original_system_prompt
        )

        save_history(
            history=history,
            data_dir=data_dir,
            history_file=history_file,
        )