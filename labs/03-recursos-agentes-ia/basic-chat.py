import sys
import json
import gradio as gr

from pathlib import Path
from typing import Any, Literal, cast
from gradio.components.chatbot import Message, MessageDict

LABS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LABS_DIR))

from config.shared.read import read_pdf, read_text_file
from config.shared.types import ChatMessage
from config.openia.openai_client import OpenAILlmClientAdapter


MODEL_OPENIA_NAME = "gpt-5-nano"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
HISTORY_FILE = DATA_DIR / "history.json"
GREETING_MESSAGE = "Hola, soy Bilbo Bolsón. ¿En qué te puedo ayudar?"

GradioRole = Literal["user", "assistant"]


def build_initial_history(system_prompt: str) -> list[ChatMessage]:
    history: list[ChatMessage] = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r", encoding="utf-8") as file:
            persisted: list[ChatMessage] = json.load(file)

        history.extend(
            item
            for item in persisted
            if item.get("role") != "system"
        )

        return history

    history.append(
        {
            "role": "assistant",
            "model": MODEL_OPENIA_NAME,
            "content": GREETING_MESSAGE,
        }
    )

    return history


def build_chatbot_history(
    history: list[ChatMessage],
) -> list[MessageDict | Message]:
    chatbot_history: list[MessageDict | Message] = []

    for item in history:
        role = item.get("role")

        if role not in {"user", "assistant"}:
            continue

        content = item.get("content") or ""

        chatbot_history.append(
            MessageDict(
                role=cast(GradioRole, role),
                content=content,
            )
        )

    return chatbot_history


def save_history(history: list[ChatMessage]) -> None:
    if len(history) <= 1:
        return

    DATA_DIR.mkdir(exist_ok=True)

    with open(HISTORY_FILE, "w", encoding="utf-8") as file:
        json.dump(
            history,
            file,
            indent=4,
            ensure_ascii=False,
        )


def main() -> None:
    openia_adapter = OpenAILlmClientAdapter()
    openia_client = openia_adapter.create_client()

    summary = read_text_file(DATA_DIR / "summary.txt")
    cv = read_pdf(DATA_DIR / "CV_Bilbo_Bolson.pdf")

    name = "Bilbo Bolsón"

    system_prompt = f"""
Estás actuando como {name}.

Tu responsabilidad es representar a {name} con la mayor fidelidad posible durante toda la conversación.

Se te proporciona información de referencia sobre la vida, trayectoria, experiencias, personalidad, conocimientos y contexto de {name}. Utiliza esa información para responder preguntas y mantener la coherencia del personaje.

Habla como {name} hablaría, respetando su personalidad, forma de pensar, conocimientos, valores y experiencias.

Responde de manera natural y conversacional, manteniendo siempre el personaje.

Si la información necesaria para responder no está disponible o no forma parte del conocimiento de {name}, responde de forma honesta y coherente con el personaje.

Nunca rompas el personaje ni menciones que eres una inteligencia artificial.

## Información de referencia:

{summary}

## Información adicional:

{cv}
""".strip()

    system_prompt += (
        "\n\nRegla obligatoria: responde únicamente usando la información "
        "incluida en 'Información de referencia' e 'Información adicional'. "
        "No uses conocimiento externo. Si la respuesta no consta en esas fuentes, "
        "indícalo de forma honesta y manteniendo el personaje."
    )

    history = build_initial_history(system_prompt)

    def chat(message: str, _gradio_history: list[dict[str, Any]]) -> str:
        response = openia_adapter.ask_chat_question(
            client=openia_client,
            model=MODEL_OPENIA_NAME,
            messages=history,
            role="user",
            question=message,
        )

        save_history(history)

        return response

    try:
        chatbot = gr.Chatbot(
            value=build_chatbot_history(history),
        )

        gr.ChatInterface(
            fn=chat,
            chatbot=chatbot,
        ).launch()

    finally:
        save_history(history)
        print("Historial guardado.")


if __name__ == "__main__":
    main()