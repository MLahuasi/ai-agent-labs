import sys
from pathlib import Path
from typing import Any

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from google import genai

from config.gemini.tools import ask_chat_question
from config.gemini.config import GEMINI_GENERATION_CONFIG


def create_chat(client: genai.Client, model: str) -> Any:
    return client.chats.create(
        model=model,
        config=GEMINI_GENERATION_CONFIG,
    )


def execute_chat_completion_example(client: genai.Client, model: str) -> None:
    print("*** CHAT COMPLETIONS ***")

    chat = create_chat(client, model)

    question = (
        "Proponga una pregunta difícil y desafiante para evaluar "
        "el coeficiente intelectual de alguien. "
        "Responde únicamente con la pregunta."
    )

    answer = ask_chat_question(chat, question)

    print("---- Respuesta Gemini -----")

    ask_chat_question(chat, answer)


def execute_chat_completion_custom_example(client: genai.Client, model: str) -> None:
    print("------- EJEMPLO AGENTIC SIMPLE -------")
    chat = create_chat(client, model)

    question = (
        "Elige una tarea cotidiana que pueda mejorar con un agente de IA. "
        "Responde solo con el nombre de la tarea, maximo 6 palabras."
    )

    task = ask_chat_question(chat, question)

    question = (
        f"Para la tarea '{task}', identifica el principal obstaculo. "
        "Responde en una frase de maximo 12 palabras."
    )

    obstacle = ask_chat_question(chat, question)

    question = (
        f"Propon una accion concreta para resolver este obstaculo: '{obstacle}'. "
        "Responde en una frase de maximo 15 palabras."
    )

    ask_chat_question(chat, question)
