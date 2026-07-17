import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.ollama.ollama_client import OllamaLlmClientAdapter
from config.shared.types import ChatMessage
from openai import OpenAI as Client


def create_ollama_client() -> Client:
    return Client()


def execute_chat_example(
    client: Client,
    model: str,
    messages: list[ChatMessage],
) -> None:
    print("*** CHAT OLLAMA ***")

    ollama_client = OllamaLlmClientAdapter()

    question = (
        "Proponga una pregunta difícil y desafiante para evaluar "
        "el coeficiente intelectual de alguien. "
        "Responde únicamente con la pregunta."
    )

    answer = ollama_client.ask_chat_question(
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

    ollama_client = OllamaLlmClientAdapter()

    question = (
        "Elige una tarea cotidiana que pueda mejorar con un agente de IA. "
        "Responde solo con el nombre de la tarea, maximo 6 palabras."
    )

    answer = ollama_client.ask_chat_question(
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

    answer = ollama_client.ask_chat_question(
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

    ollama_client.ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        role="user",
        question=question,
    )
