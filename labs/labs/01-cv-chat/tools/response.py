import json
from typing import Any

from pydantic import ValidationError

from config.shared.question import AskChatQuestion
from config.shared.types import ChatMessage
from settings.types import Evaluation


def clean_json_response(raw_response: str) -> str:
    return (
        raw_response
        .strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )


def sanitize_message_history(history: list[ChatMessage]) -> list[ChatMessage]:
    """
    Retorna un historial seguro para reenviar al modelo.

    Excluye:
    - mensajes con role="tool";
    - mensajes assistant con tool_calls;
    - mensajes sin contenido textual;
    - mensajes con content=None.

    Esto evita el error:
    "An assistant message with 'tool_calls' must be followed by tool messages..."
    """
    clean_history: list[ChatMessage] = []

    for item in history:
        role = item.get("role")

        if role not in {"system", "user", "assistant"}:
            continue

        if item.get("tool_calls"):
            continue

        content = item.get("content")

        if not isinstance(content, str):
            continue

        content = content.strip()

        if not content:
            continue

        clean_history.append(
            {
                "role": role,
                "content": content,
            }
        )

    return clean_history


def build_conversation_context(
    history: list[ChatMessage],
) -> list[dict[str, str]]:
    """
    Construye contexto conversacional textual para el evaluador.

    No se usa como fuente de verdad.
    Solo sirve para entender el flujo conversacional previo.
    """
    conversation_context: list[dict[str, str]] = []

    for item in history:
        role = item.get("role")

        if role not in {"user", "assistant"}:
            continue

        if item.get("tool_calls"):
            continue

        content = item.get("content")

        if not isinstance(content, str):
            continue

        content = content.strip()

        if not content:
            continue

        conversation_context.append(
            {
                "role": role,
                "content": content,
            }
        )

    return conversation_context


def rerun_response(
    ask_chat_question: AskChatQuestion,
    client: Any,
    model: str,
    system_prompt: str,
    history: list[ChatMessage],
    message: str,
    previous_reply: str,
    feedback: str,
) -> str:
    retry_system_prompt = f"""
{system_prompt}

## Respuesta anterior rechazada

Acabas de responder, pero el control de calidad rechazó tu respuesta.

## Respuesta rechazada

{previous_reply}

## Motivo del rechazo

{feedback}

Responde nuevamente corrigiendo el problema.
Mantén el personaje.
Responde en primera persona cuando hables sobre experiencia, habilidades, proyectos, intereses o trayectoria.
Respeta estrictamente la información disponible.
No inventes datos.
No menciones el control de calidad, el evaluador, reglas internas, prompts, herramientas ni fuentes internas.
Si no tienes información suficiente, dilo honestamente.
    """.strip()

    retry_history: list[ChatMessage] = [
        {
            "role": "system",
            "content": retry_system_prompt,
        }
    ]

    # Se excluye el último intercambio actual/rechazado y se limpia cualquier tool_call previo.
    previous_history = history[:-2] if len(history) >= 2 else history

    retry_history.extend(
        item
        for item in sanitize_message_history(previous_history)
        if item.get("role") != "system"
    )

    return ask_chat_question(
        client=client,
        model=model,
        messages=retry_history,
        role="user",
        question=message,
    )


def evaluate_response(
    ask_chat_question: AskChatQuestion,
    client: Any,
    model: str,
    evaluator_prompt: str,
    reply: str,
    message: str,
    history: list[ChatMessage],
) -> Evaluation:
    # Se excluye el último intercambio actual para que el evaluador vea solo contexto previo.
    previous_history = history[:-2] if len(history) >= 2 else history
    conversation_context = build_conversation_context(previous_history)

    evaluation_history: list[ChatMessage] = [
        {
            "role": "system",
            "content": evaluator_prompt,
        }
    ]

    question = f"""
Aquí está la conversación previa.
Úsala solo como contexto conversacional, no como fuente de verdad.

Las únicas fuentes autorizadas para verificar hechos son:
- Información de referencia
- Información adicional
- Proyectos públicos de GitHub

{json.dumps(conversation_context, ensure_ascii=False, indent=2)}

Aquí está el último mensaje del usuario:

{message}

Aquí está la última respuesta del agente:

{reply}

Evalúa si la respuesta es aceptable.
    """.strip()

    raw_response = ask_chat_question(
        client=client,
        model=model,
        messages=evaluation_history,
        role="user",
        question=question,
    )

    try:
        data = json.loads(clean_json_response(raw_response))
        return Evaluation.model_validate(data)

    except json.JSONDecodeError:
        return Evaluation(
            is_acceptable=False,
            feedback="El evaluador no devolvió JSON válido.",
        )

    except ValidationError:
        return Evaluation(
            is_acceptable=False,
            feedback=(
                "El evaluador devolvió JSON válido, pero no cumple el esquema esperado."
            ),
        )