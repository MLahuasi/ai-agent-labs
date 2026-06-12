import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))

from config.openia.openai_client import create_openai_client as create_base_openai_client, ask_chat_question
from config.shared.types import ChatMessage
from openai import OpenAI




def create_openai_client() -> OpenAI:
    return create_base_openai_client()

def execute_chat_example(
        client: OpenAI, 
        model: str, 
        messages: list[ChatMessage]
    ) -> None:
    print("*** CHAT OPENIA ***")
    

    question = (
        "Proponga una pregunta difícil y desafiante para evaluar "
        "el coeficiente intelectual de alguien. "
        "Responde únicamente con la pregunta."
    )

    answer = ask_chat_question(
        client=client,
        model=model,
        messages=messages,
        question=question,
        role="user"
    )

    print("- Respuesta OpenIA:", answer)


def execute_chat_custom_example(
        client: OpenAI, 
        model: str, 
        messages: list[ChatMessage]
    ) -> None:

    print("------- OPENIA AGENTIC SIMPLE -------")
    
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
