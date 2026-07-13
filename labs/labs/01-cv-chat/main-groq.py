import sys

from pathlib import Path
from typing import Any, cast

import gradio as gr

from gradio.components.chatbot import (
    Message,
    MessageDict,
)


# Permite importar los módulos compartidos ubicados en labs/config.
LABS_DIR = Path(__file__).resolve().parents[2]

sys.path.insert(
    0,
    str(LABS_DIR),
)


from agent_tools.schemas import build_tools
from agent_tools.tool_calls import handle_tool_calls

from config.groq.groq_client import (
    GroqLlmClientAdapter,
)
from config.ollama.ollama_client import (
    OllamaLlmClientAdapter,
)

from prompts.evaluator import build_evaluator_prompt
from prompts.greeting import build_greeting_message
from prompts.system import build_system_prompt

from rag.retriever import RagRetriever

from tools.chat import chat
from tools.history import (
    build_chatbot_history,
    load_history,
    save_history,
)


# Modelo utilizado para generar las respuestas mediante Groq.
MODEL_GROQ_NAME = "llama-3.1-8b-instant"

# Modelo local utilizado únicamente para generar embeddings.
EMBEDDING_MODEL_OLLAMA_NAME = "nomic-embed-text"


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

HISTORY_FILE = (
    DATA_DIR
    / "history-evaluator-groq.json"
)


def main() -> None:
    """
    Configura Groq para chat y Ollama para embeddings RAG.
    """

    # Groq mantiene la responsabilidad de chat y tools.
    groq_adapter = GroqLlmClientAdapter()

    groq_client = (
        groq_adapter.create_client()
    )

    # Groq no implementa generación de embeddings.
    # Ollama se utiliza únicamente para el flujo RAG.
    embedding_adapter = (
        OllamaLlmClientAdapter()
    )

    embedding_client = (
        embedding_adapter.create_client()
    )

    name = "Mauricio Lahuasi"

    # Se mantienen las tools existentes del laboratorio.
    tools = build_tools(
        name
    )

    greeting = build_greeting_message(
        name
    )

    # El retriever recibe el adapter especializado
    # en embeddings y no el adapter utilizado para el chat.
    retriever = RagRetriever(
        llm_adapter=embedding_adapter,
        client=embedding_client,
        data_dir=DATA_DIR,
        embedding_model=(
            EMBEDDING_MODEL_OLLAMA_NAME
        ),
    )

    # El historial conserva un prompt estable.
    # El contexto real se recuperará por cada consulta.
    base_system_prompt = build_system_prompt(
        name=name,
        retrieved_context=(
            "El contexto relevante se recuperará "
            "cuando el usuario realice una consulta."
        ),
    )

    history = load_history(
        greeting_message=greeting,
        model_ia=MODEL_GROQ_NAME,
        system_prompt=base_system_prompt,
        history_file=HISTORY_FILE,
    )

    chatbot_history = (
        build_chatbot_history(
            history=history
        )
    )

    gradio_chatbot_history = cast(
        list[MessageDict | Message],
        chatbot_history,
    )

    try:
        chatbot = gr.Chatbot(
            value=gradio_chatbot_history,
        )

        def gradio_chat(
            message: str,
            gradio_history: list[
                dict[str, Any]
            ],
        ) -> str:
            """
            Recupera el contexto mediante Ollama
            y genera la respuesta mediante Groq.
            """

            # Ollama transforma la consulta en embedding
            # y recupera los fragmentos relacionados.
            retrieved_context = (
                retriever.retrieve(
                    message
                )
            )

            # Groq recibirá únicamente los fragmentos
            # recuperados para la consulta actual.
            turn_system_prompt = (
                build_system_prompt(
                    name=name,
                    retrieved_context=(
                        retrieved_context
                    ),
                )
            )

            # El evaluador utiliza el mismo contexto
            # entregado al modelo de chat.
            evaluator_prompt = (
                build_evaluator_prompt(
                    name=name,
                    system_prompt=(
                        turn_system_prompt
                    ),
                )
            )

            return chat(
                ask_chat_question=(
                    groq_adapter
                    .ask_chat_question
                ),
                client=groq_client,
                model=MODEL_GROQ_NAME,
                system_prompt=(
                    turn_system_prompt
                ),
                evaluator_prompt=(
                    evaluator_prompt
                ),
                history=history,
                data_dir=DATA_DIR,
                history_file=HISTORY_FILE,
                message=message,
                _gradio_history=(
                    gradio_history
                ),
                tools=tools,
                handle_tool_calls=(
                    handle_tool_calls
                ),
            )

        gr.ChatInterface(
            fn=gradio_chat,
            chatbot=chatbot,
        ).launch()

    finally:
        save_history(
            data_dir=DATA_DIR,
            history=history,
            history_file=HISTORY_FILE,
        )

        print(
            "Historial guardado."
        )


if __name__ == "__main__":
    main()

