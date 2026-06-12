import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.ollama.ollama_client import (
    ask_chat_question,
    create_ollama_client as create_base_ollama_client,
)
from config.shared.types import ChatMessage
from ollama import Client


def create_ollama_client() -> Client:
    return create_base_ollama_client()


def execute_chat_example(
    client: Client,
    model: str,
    messages: list[ChatMessage],
) -> None:
    print("*** CHAT OLLAMA ***")

    question = (
        "Proponga una pregunta difícil y desafiante para evaluar "
        "el coeficiente intelectual de alguien. "
        "Responde únicamente con la pregunta."
    )

    answer = ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        role="user",
        question=question,
    )

    print("- Respuesta Ollama:", answer)


def execute_chat_custom_example(
    client: Client,
    model: str,
    messages: list[ChatMessage],
) -> None:
    print("------- OLLAMA AGENTIC SIMPLE -------")

    question = (
        "Elige una tarea cotidiana que pueda mejorar con un agente de IA. "
        "Responde solo con el nombre de la tarea, maximo 6 palabras."
    )

    answer = ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        role="user",
        question=question,
    )

    question = (
        f"Para la tarea '{answer}', identifica el principal obstaculo. "
        "Responde en una frase de maximo 12 palabras."
    )

    answer = ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        role="user",
        question=question,
    )

    question = (
        f"Propon una accion concreta para resolver este obstaculo: '{answer}'. "
        "Responde en una frase de maximo 15 palabras."
    )

    ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        role="user",
        question=question,
    )
