import sys
import json
import gradio as gr

from pathlib import Path
from typing import Any
from pydantic import BaseModel, ValidationError


LABS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LABS_DIR))

from config.shared.read import read_pdf, read_text_file
from config.shared.types import ChatMessage
from config.openia.openai_client import create_openai_client, ask_chat_question
from prompts.main import build_system_prompt, build_evaluator_prompt


MODEL_OPENIA_NAME = "gpt-5-nano"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
HISTORY_FILE = DATA_DIR / "history-evaluator.json"


class Evaluation(BaseModel):
    is_acceptable: bool
    feedback: str


def load_history(system_prompt: str) -> list[ChatMessage]:
    if not HISTORY_FILE.exists():
        return [
            {
                "role": "system",
                "content": system_prompt,
            }
        ]
        
    with open(HISTORY_FILE, "r", encoding="utf-8") as file:
        persisted = json.load(file)

    has_system_prompt = any(
        item.get("role") == "system"
        for item in persisted
    )

    if has_system_prompt:
        return persisted

    return [
        {
            "role": "system",
            "content": system_prompt,
        },
        *persisted,
    ]


def save_history(history: list[ChatMessage]) -> None:
    DATA_DIR.mkdir(exist_ok=True)

    with open(HISTORY_FILE, "w", encoding="utf-8") as file:
        json.dump(
            history,
            file,
            indent=4,
            ensure_ascii=False,
        )


def evaluate_response(
    client: Any,
    model: str,
    evaluator_prompt: str,
    reply: str,
    message: str,
    history: list[ChatMessage],
) -> Evaluation:
    evaluation_history: list[ChatMessage] = [
        {
            "role": "system",
            "content": evaluator_prompt,
        }
    ]

    question = f"""
Aquí está la conversación previa:

{history}

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
        data = json.loads(raw_response)
        return Evaluation.model_validate(data)

    except json.JSONDecodeError:
        return Evaluation(
            is_acceptable=False,
            feedback="El evaluador no devolvió JSON válido.",
        )

    except ValidationError:
        return Evaluation(
            is_acceptable=False,
            feedback="El evaluador devolvió JSON, pero no cumple el esquema esperado.",
        )


def rerun_response(
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
""".strip()

    retry_history: list[ChatMessage] = [
        {
            "role": "system",
            "content": retry_system_prompt,
        }
    ]

    retry_history.extend(
        item
        for item in history
        if item.get("role") != "system"
    )

    return ask_chat_question(
        client=client,
        model=model,
        messages=retry_history,
        role="user",
        question=message,
    )


def main() -> None:
    openia_client = create_openai_client()

    name = "Bilbo Bolsón"

    summary = read_text_file(DATA_DIR / "summary.txt")
    cv = read_pdf(DATA_DIR / "CV_Bilbo_Bolson.pdf")

    system_prompt = build_system_prompt(
        name=name,
        summary=summary,
        cv=cv,
    )

    evaluator_prompt = build_evaluator_prompt(
        name=name,
        summary=summary,
        cv=cv,
    )

    history = load_history(system_prompt)

    def chat(message: str, _gradio_history: list[dict[str, Any]]) -> str:
        reply = ask_chat_question(
            client=openia_client,
            model=MODEL_OPENIA_NAME,
            messages=history,
            role="user",
            question=message,
        )

        evaluation = evaluate_response(
            client=openia_client,
            model=MODEL_OPENIA_NAME,
            evaluator_prompt=evaluator_prompt,
            reply=reply,
            message=message,
            history=history,
        )

        if evaluation.is_acceptable:
            print("Evaluación aprobada.")
        else:
            print("Evaluación rechazada.")
            print(evaluation.feedback)

            reply = rerun_response(
                client=openia_client,
                model=MODEL_OPENIA_NAME,
                system_prompt=system_prompt,
                history=history,
                message=message,
                previous_reply=reply,
                feedback=evaluation.feedback,
            )

            history[-1] = {
                "role": "assistant",
                "model": MODEL_OPENIA_NAME,
                "content": reply,
            }

        save_history(history)

        return reply

    try:
        gr.ChatInterface(
            fn=chat
        ).launch()

    finally:
        save_history(history)
        print("Historial guardado.")


if __name__ == "__main__":
    main()