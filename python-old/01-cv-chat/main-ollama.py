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


# Permite utilizar los módulos compartidos
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


# Modelo utilizado para:
#
# - conversación;
# - evaluación;
# - corrección;
# - tool calling.
#
# Se conserva llama3.1:8b para no introducir un cambio
# adicional durante la homologación funcional.
MODEL_OLLAMA_NAME = (
    "llama3.2"
)


# Modelo especializado utilizado únicamente
# para embeddings y recuperación RAG.
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
    / "history-evaluator-ollama.json"
)


def main() -> None:
    """
    Configura el flujo local de Ollama.

    El punto de entrada solamente compone dependencias:

    - adapter;
    - cliente;
    - modelos;
    - RAG;
    - tools;
    - historial;
    - Gradio.

    No contiene lógica específica del SDK ni reglas
    particulares de las herramientas.
    """

    # ---------------------------------------------------------------------
    # Adapter y cliente
    # ---------------------------------------------------------------------

    ollama_adapter = (
        OllamaLlmClientAdapter()
    )

    # La misma conexión local se reutiliza para:
    #
    # - chat;
    # - embeddings.
    #
    # Los modelos continúan siendo independientes.
    ollama_client = (
        ollama_adapter
        .create_client()
    )

    name = (
        "Mauricio Lahuasi"
    )

    # Las definiciones de tools permanecen neutrales.
    #
    # El adapter las entrega a Ollama mediante
    # la API compatible con OpenAI.
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

    # El retriever recibe el adapter mediante su contrato.
    #
    # No conoce:
    #
    # - OpenAI();
    # - /v1/embeddings;
    # - detalles del servidor Ollama.
    retriever = (
        RagRetriever(
            llm_adapter=(
                ollama_adapter
            ),
            client=(
                ollama_client
            ),
            data_dir=(
                DATA_DIR
            ),
            embedding_model=(
                EMBEDDING_MODEL_OLLAMA_NAME
            ),
        )
    )

    # El historial almacena un prompt base estable.
    #
    # El contexto real se recupera nuevamente
    # para cada pregunta.
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
            MODEL_OLLAMA_NAME
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
            2. RAG recupera los fragmentos relevantes.
            3. Se construye el system prompt del turno.
            4. Ollama responde o solicita tools.
            5. La lógica común procesa el resultado.
            """

            retrieved_context = (
                retriever.retrieve(
                    message
                )
            )

            # Se utiliza únicamente el contexto recuperado
            # para la consulta actual.
            turn_system_prompt = (
                build_system_prompt(
                    name=name,
                    retrieved_context=(
                        retrieved_context
                    ),
                )
            )

            # El evaluador recibe la misma evidencia
            # que recibió el modelo generador.
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
                client=(
                    ollama_client
                ),
                model=(
                    MODEL_OLLAMA_NAME
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
        # chat() guarda después de cada turno.
        #
        # Este guardado adicional protege el último
        # estado al cerrar Gradio.
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