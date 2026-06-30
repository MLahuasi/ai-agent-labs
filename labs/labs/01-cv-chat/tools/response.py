import json
from typing import Any


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
Mantén el personaje y respeta estrictamente la información disponible.
No inventes datos.
Si no tienes información suficiente, dilo honestamente.
""".strip()

    retry_history: list[ChatMessage] = [
        {
            "role": "system",
            "content": retry_system_prompt,
        }
    ]

    retry_history.extend(
        item
        for item in history[:-2]
        if item.get("role") in {"user", "assistant"}
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
    
    conversation_context = [
        item
        for item in history[:-2]
        if item.get("role") in {"user", "assistant"}
    ]

    evaluation_history: list[ChatMessage] = [
        {
            "role": "system",
            "content": evaluator_prompt,
        }
    ]

    # print(f"Prompt Evaluator: {evaluator_prompt}")

    question = f"""
Aquí está la conversación previa.
Úsala solo como contexto conversacional, no como fuente de verdad.
Las únicas fuentes autorizadas para verificar hechos son
"Información de referencia" e "Información adicional".

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

    # print(f"Respueta Evaluator: {raw_response}")

    try:
        data = json.loads(clean_json_response(raw_response))
        return Evaluation.model_validate(data)
    
    except json.JSONDecodeError:
        return Evaluation(
            is_acceptable=False,
            feedback="El evaluador no devolvió JSON válido.",
        )
    
