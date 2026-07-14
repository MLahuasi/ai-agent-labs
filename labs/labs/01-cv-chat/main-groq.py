import sys

from pathlib import Path
from typing import (
    Any,
    cast,
)

import gradio as gr

from gradio.components.chatbot import (
    Message,
    MessageDict,
)


# Permite importar los módulos compartidos
# ubicados dentro de labs/config.
LABS_DIR = (
    Path(__file__)
    .resolve()
    .parents[2]
)

sys.path.insert(
    0,
    str(LABS_DIR),
)


from agent_tools.schemas import (
    build_tools,
)

from agent_tools.tool_calls import (
    handle_tool_calls,
)

from config.groq.config import (
    GROQ_DEFAULT_MODEL,
)

from config.groq.groq_client import (
    GroqLlmClientAdapter,
)

from config.ollama.ollama_client import (
    OllamaLlmClientAdapter,
)

from prompts.evaluator import (
    build_evaluator_prompt,
)

from prompts.greeting import (
    build_greeting_message,
)

from prompts.system import (
    build_system_prompt,
)

from rag.retriever import (
    RagRetriever,
)

from tools.chat import (
    chat,
)

from tools.history import (
    build_chatbot_history,
    load_history,
    save_history,
)


# El modelo se define en config/groq/config.py.
#
# Esto evita mantener dos valores diferentes:
#
# - GROQ_DEFAULT_MODEL en la configuración;
# - MODEL_GROQ_NAME en el punto de entrada.
MODEL_GROQ_NAME = (
    GROQ_DEFAULT_MODEL
)


# Ollama se utiliza únicamente para embeddings.
#
# Groq permanece dedicado a:
#
# - conversación;
# - evaluación;
# - corrección;
# - tool calling.
EMBEDDING_MODEL_OLLAMA_NAME = (
    "nomic-embed-text"
)


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
)

DATA_DIR = (
    BASE_DIR
    / "data"
)

HISTORY_FILE = (
    DATA_DIR
    / "history-evaluator-groq.json"
)


def main() -> None:
    """
    Configura el flujo:

    Groq:
        - chat;
        - evaluación;
        - corrección;
        - tools.

    Ollama:
        - embeddings RAG.

    El punto de entrada solamente compone dependencias.
    No contiene lógica específica de los SDK.
    """

    # ---------------------------------------------------------------------
    # Adapter de conversación
    # ---------------------------------------------------------------------

    groq_adapter = (
        GroqLlmClientAdapter()
    )

    groq_client = (
        groq_adapter
        .create_client()
    )

    # ---------------------------------------------------------------------
    # Adapter de embeddings
    # ---------------------------------------------------------------------

    # Groq no implementa embeddings.
    #
    # El retriever recibe un adapter independiente
    # para mantener separadas ambas capacidades.
    embedding_adapter = (
        OllamaLlmClientAdapter()
    )

    embedding_client = (
        embedding_adapter
        .create_client()
    )

    name = (
        "Mauricio Lahuasi"
    )

    # Las definiciones permanecen neutrales.
    #
    # El adapter de Groq las entrega a la API
    # utilizando el formato compatible con OpenAI.
    tools = build_tools(
        name
    )

    greeting = (
        build_greeting_message(
            name
        )
    )

    # ---------------------------------------------------------------------
    # RAG
    # ---------------------------------------------------------------------

    # El retriever depende del contrato del adapter.
    #
    # No utiliza directamente:
    #
    # - ollama.Client;
    # - ollama.embeddings;
    # - detalles del SDK local.
    retriever = (
        RagRetriever(
            llm_adapter=(
                embedding_adapter
            ),
            client=(
                embedding_client
            ),
            data_dir=(
                DATA_DIR
            ),
            embedding_model=(
                EMBEDDING_MODEL_OLLAMA_NAME
            ),
        )
    )

    # El historial conserva un prompt estable.
    #
    # El contexto RAG específico se recupera
    # nuevamente para cada consulta.
    base_system_prompt = (
        build_system_prompt(
            name=name,
            retrieved_context=(
                "El contexto relevante "
                "se recuperará cuando "
                "el usuario realice "
                "una consulta."
            ),
        )
    )

    history = load_history(
        greeting_message=(
            greeting
        ),
        model_ia=(
            MODEL_GROQ_NAME
        ),
        system_prompt=(
            base_system_prompt
        ),
        history_file=(
            HISTORY_FILE
        ),
    )

    chatbot_history = (
        build_chatbot_history(
            history=history
        )
    )

    gradio_chatbot_history = cast(
        list[
            MessageDict
            | Message
        ],
        chatbot_history,
    )

    try:
        chatbot = gr.Chatbot(
            value=(
                gradio_chatbot_history
            ),
        )

        def gradio_chat(
            message: str,
            gradio_history: list[
                dict[
                    str,
                    Any,
                ]
            ],
        ) -> str:
            """
            Ejecuta un turno completo.

            Flujo:

            1. Ollama genera el embedding de la consulta.
            2. RagRetriever recupera fragmentos relevantes.
            3. Groq recibe el contexto del turno.
            4. Groq responde o solicita tools.
            5. El flujo común evalúa la respuesta cuando
               no se utilizaron herramientas.
            """

            retrieved_context = (
                retriever.retrieve(
                    message
                )
            )

            # El modelo recibe únicamente el contexto
            # recuperado para la consulta actual.
            turn_system_prompt = (
                build_system_prompt(
                    name=name,
                    retrieved_context=(
                        retrieved_context
                    ),
                )
            )

            # El evaluador recibe exactamente la misma
            # evidencia utilizada para generar la respuesta.
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
                client=(
                    groq_client
                ),
                model=(
                    MODEL_GROQ_NAME
                ),
                system_prompt=(
                    turn_system_prompt
                ),
                evaluator_prompt=(
                    evaluator_prompt
                ),
                history=history,
                data_dir=(
                    DATA_DIR
                ),
                history_file=(
                    HISTORY_FILE
                ),
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
        # chat() guarda el historial al finalizar
        # cada turno.
        #
        # Este guardado adicional protege el último
        # estado cuando se cierra la interfaz.
        save_history(
            data_dir=(
                DATA_DIR
            ),
            history=history,
            history_file=(
                HISTORY_FILE
            ),
        )

        print(
            "Historial guardado."
        )


if __name__ == "__main__":
    main()