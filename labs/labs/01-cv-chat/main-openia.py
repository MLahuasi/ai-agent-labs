import sys

from pathlib import Path
from typing import Any, cast

import gradio as gr

from gradio.components.chatbot import Message, MessageDict


# Permite importar los módulos compartidos ubicados en labs/config.
LABS_DIR = Path(__file__).resolve().parents[2]

sys.path.insert(0, str(LABS_DIR))


from agent_tools.schemas import build_tools
from agent_tools.tool_calls import handle_tool_calls

from config.openia.openai_client import OpenAILlmClientAdapter

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


# Modelo utilizado para generar respuestas.
MODEL_OPENIA_NAME = "gpt-5-nano"

# Modelo utilizado exclusivamente para generar embeddings.
# Los modelos de chat y embeddings tienen responsabilidades diferentes.
EMBEDDING_MODEL_NAME = "text-embedding-3-small"


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

HISTORY_FILE = DATA_DIR / "history-evaluator-openia.json"


def main() -> None:
    """
    Configura el cliente, el RAG, las tools y la interfaz de chat.
    """

    # El adapter encapsula las operaciones específicas de OpenAI.
    openia_adapter = OpenAILlmClientAdapter()

    # La misma instancia del cliente se reutiliza para chat y embeddings.
    openia_client = openia_adapter.create_client()

    name = "Mauricio Lahuasi"

    # Se mantienen las tools existentes del laboratorio.
    tools = build_tools(name)

    greeting = build_greeting_message(name)

    # El retriever se crea una sola vez al iniciar la aplicación.
    # Durante la inicialización carga o construye el índice RAG.
    retriever = RagRetriever(
        llm_adapter=openia_adapter,
        client=openia_client,
        data_dir=DATA_DIR,
        embedding_model=EMBEDDING_MODEL_NAME,
    )

    # El historial necesita un system prompt inicial.
    # No se incluyen documentos completos porque el contexto
    # será recuperado dinámicamente en cada consulta.
    base_system_prompt = build_system_prompt(
        name=name,
        retrieved_context=(
            "El contexto relevante será recuperado "
            "cuando el usuario realice una consulta."
        ),
    )

    history = load_history(
        greeting_message=greeting,
        model_ia=MODEL_OPENIA_NAME,
        system_prompt=base_system_prompt,
        history_file=HISTORY_FILE,
    )

    chatbot_history = build_chatbot_history(
        history=history,
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
            gradio_history: list[dict[str, Any]],
        ) -> str:
            """
            Recupera contexto para la consulta actual
            y ejecuta el flujo existente de chat.
            """

            # Busca únicamente los fragmentos relacionados
            # con el mensaje actual del usuario.
            retrieved_context = retriever.retrieve(
                message
            )

            # Construye un system prompt específico para este turno.
            turn_system_prompt = build_system_prompt(
                name=name,
                retrieved_context=retrieved_context,
            )

            # El evaluador recibe el mismo contexto utilizado
            # para generar la respuesta.
            evaluator_prompt = build_evaluator_prompt(
                name=name,
                system_prompt=turn_system_prompt,
            )

            return chat(
                ask_chat_question=(
                    openia_adapter.ask_chat_question
                ),
                client=openia_client,
                model=MODEL_OPENIA_NAME,
                system_prompt=turn_system_prompt,
                evaluator_prompt=evaluator_prompt,
                history=history,
                data_dir=DATA_DIR,
                history_file=HISTORY_FILE,
                message=message,
                _gradio_history=gradio_history,
                tools=tools,
                handle_tool_calls=handle_tool_calls,
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

        print("Historial guardado.")


if __name__ == "__main__":
    main()