import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.gemini.gemini_client import create_gemini_client as create_base_gemini_client, ask_chat_question
from config.shared.types import ChatMessage
from google.genai import Client




def create_gemini_client() -> Client:
    return create_base_gemini_client()


def execute_chat_example(
        client: Client,
        model: str,
        messages: list[ChatMessage],
) -> None:
    print("*** CHAT GEMINI ***")

    question = (
        "Proponga una pregunta difícil y desafiante para evaluar "
        "el coeficiente intelectual de alguien. "
        "Responde únicamente con la pregunta."
    )

    answer = ask_chat_question(
        client=client,
        messages=messages,
        model=model,
        question=question,
        role="user"
    )
    print("- Respuesta Gemini:", answer)


def execute_chat_custom_example(
        client: Client,
        model: str,
        messages: list[ChatMessage],
) -> None:
    print("------- GEMINI AGENTIC SIMPLE -------")

    question = (
        "Elige una tarea cotidiana que pueda mejorar con un agente de IA. "
        "Responde solo con el nombre de la tarea, maximo 6 palabras."
    )

    answer = ask_chat_question(
        client=client,
        messages=messages,
        model=model,
        question=question,
        role="user"
    )
    # print("- Respuesta Gemini:", answer)

    question = (
        f"Para la tarea '{answer}', identifica el principal obstaculo. "
        "Responde en una frase de maximo 12 palabras."
    )

    answer = ask_chat_question(
        client=client,
        messages=messages,
        model=model,
        question=question,
        role="user"
    )

    question = (
        f"Propon una accion concreta para resolver este obstaculo: '{answer}'. "
        "Responde en una frase de maximo 15 palabras."
    )

    answer = ask_chat_question(
        client=client,
        messages=messages,
        model=model,
        question=question,
        role="user"
    )
