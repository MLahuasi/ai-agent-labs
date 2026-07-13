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

from config.gemini.gemini_client import (
    GeminiLlmClientAdapter,
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
MODEL_GEMINI_NAME = "gemini-2.5-flash-lite"

# Modelo especializado utilizado únicamente para generar embeddings.
EMBEDDING_MODEL_GEMINI_NAME = "gemini-embedding-001"


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

HISTORY_FILE = (
    DATA_DIR
    / "history-evaluator-gemini.json"
)


def main() -> None:
    """
    Configura Gemini, RAG, tools, historial y la interfaz de chat.
    """

    # El adapter encapsula las operaciones específicas de Gemini.
    gemini_adapter = GeminiLlmClientAdapter()

    # La misma instancia se reutiliza para chat y embeddings.
    gemini_client = (
        gemini_adapter.create_client()
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
    # Durante la inicialización carga el índice existente
    # o genera los embeddings cuando el índice no existe.
    retriever = RagRetriever(
        llm_adapter=gemini_adapter,
        client=gemini_client,
        data_dir=DATA_DIR,
        embedding_model=(
            EMBEDDING_MODEL_GEMINI_NAME
        ),
    )

    # El historial necesita un system prompt estable.
    # El contexto real será recuperado en cada mensaje.
    base_system_prompt = build_system_prompt(
        name=name,
        retrieved_context=(
            "El contexto relevante se recuperará "
            "cuando el usuario realice una consulta."
        ),
    )

    history = load_history(
        greeting_message=greeting,
        model_ia=MODEL_GEMINI_NAME,
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
            Recupera el contexto relacionado con el mensaje
            y ejecuta el flujo actual de chat.
            """

            # Busca los fragmentos relacionados únicamente
            # con la consulta actual del usuario.
            retrieved_context = (
                retriever.retrieve(
                    message
                )
            )

            # El system prompt contiene solo la información
            # recuperada para el turno actual.
            turn_system_prompt = (
                build_system_prompt(
                    name=name,
                    retrieved_context=(
                        retrieved_context
                    ),
                )
            )

            # El evaluador recibe las mismas evidencias
            # utilizadas para generar la respuesta.
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
                    gemini_adapter
                    .ask_chat_question
                ),
                client=gemini_client,
                model=MODEL_GEMINI_NAME,
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

