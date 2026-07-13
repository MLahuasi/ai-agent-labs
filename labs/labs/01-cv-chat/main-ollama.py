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


# Modelo utilizado para generar las respuestas del chat.
MODEL_OLLAMA_NAME = "llama3.1:8b"

# Modelo local utilizado únicamente para generar embeddings.
EMBEDDING_MODEL_OLLAMA_NAME = "nomic-embed-text"


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

HISTORY_FILE = (
    DATA_DIR
    / "history-evaluator-ollama.json"
)


def main() -> None:
    """
    Configura Ollama, RAG, tools, historial y la interfaz.
    """

    # El adapter encapsula las operaciones específicas de Ollama.
    ollama_adapter = (
        OllamaLlmClientAdapter()
    )

    # La misma instancia se reutiliza para chat y embeddings.
    ollama_client = (
        ollama_adapter.create_client()
    )

    name = "Mauricio Lahuasi"

    # Se mantienen las tools existentes del laboratorio.
    tools = build_tools(
        name
    )

    greeting = build_greeting_message(
        name
    )

    # El retriever se crea una sola vez.
    # Usa el mismo adapter y cliente que el flujo de chat,
    # pero utiliza un modelo especializado de embeddings.
    retriever = RagRetriever(
        llm_adapter=ollama_adapter,
        client=ollama_client,
        data_dir=DATA_DIR,
        embedding_model=(
            EMBEDDING_MODEL_OLLAMA_NAME
        ),
    )

    # El historial necesita un system prompt estable.
    # El contexto real se recuperará para cada consulta.
    base_system_prompt = build_system_prompt(
        name=name,
        retrieved_context=(
            "El contexto relevante se recuperará "
            "cuando el usuario realice una consulta."
        ),
    )

    history = load_history(
        greeting_message=greeting,
        model_ia=MODEL_OLLAMA_NAME,
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
            Recupera el contexto y ejecuta el flujo de chat.
            """

            # Busca los fragmentos relacionados
            # con el mensaje actual.
            retrieved_context = (
                retriever.retrieve(
                    message
                )
            )

            # El prompt del turno contiene únicamente
            # el contexto recuperado por RAG.
            turn_system_prompt = (
                build_system_prompt(
                    name=name,
                    retrieved_context=(
                        retrieved_context
                    ),
                )
            )

            # El evaluador recibe la misma evidencia
            # utilizada para generar la respuesta.
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
                    ollama_adapter
                    .ask_chat_question
                ),
                client=ollama_client,
                model=MODEL_OLLAMA_NAME,
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

