import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from ollama import Client

from config.ollama.tools import ask_chat_question


def execute_chat_completion_example(client: Client, model: str) -> None:
    print("*** CHAT COMPLETIONS ***")
    messages: list[dict[str, str]] = []

    question = (
        "Proponga una pregunta dificil para evaluar razonamiento. "
        "Responde unicamente con la pregunta."
    )

    answer = ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        question=question,
    )

    print("---- Respuesta Ollama -----")

    ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        question=answer,
    )


def execute_chat_completion_custom_example(client: Client, model: str) -> None:
    print("------- EJEMPLO AGENTIC SIMPLE -------")
    messages: list[dict[str, str]] = []

    question = (
        "Elige una tarea cotidiana que pueda mejorar con un agente de IA. "
        "Responde solo con el nombre de la tarea, maximo 6 palabras."
    )

    task = ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        question=question,
    )

    question = (
        f"Para la tarea '{task}', identifica el principal obstaculo. "
        "Responde en una frase de maximo 12 palabras."
    )

    obstacle = ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        question=question,
    )

    question = (
        f"Propon una accion concreta para resolver este obstaculo: '{obstacle}'. "
        "Responde en una frase de maximo 15 palabras."
    )

    ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        question=question,
    )
