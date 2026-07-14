import sys

from copy import deepcopy
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

from config.gemini.gemini_client import (
    GeminiLlmClientAdapter,
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
# - corrección de respuestas;
# - decisión de uso de tools.
MODEL_GEMINI_NAME = (
    "gemini-3-flash-preview"
)


# Modelo utilizado exclusivamente
# para generar embeddings.
EMBEDDING_MODEL_GEMINI_NAME = (
    "gemini-embedding-001"
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
    / "history-evaluator-gemini.json"
)


def main() -> None:
    """
    Configura las dependencias de Gemini.

    El punto de entrada se limita a composición:

    - crea el adapter;
    - crea el cliente;
    - configura RAG;
    - configura tools;
    - carga el historial;
    - conecta el flujo compartido con Gradio.

    No contiene lógica específica del SDK.
    """

    # El adapter encapsula:
    #
    # - Gemini API;
    # - chat;
    # - embeddings;
    # - function calling;
    # - reintentos;
    # - normalización de respuestas.
    gemini_adapter = (
        GeminiLlmClientAdapter()
    )

    gemini_client = (
        gemini_adapter
        .create_client()
    )

    name = (
        "Mauricio Lahuasi"
    )

    # Las definiciones son neutrales.
    #
    # El adapter las convierte al formato
    # FunctionDeclaration de Gemini.
    tools = build_tools(
        name
    )

    greeting = (
        build_greeting_message(
            name
        )
    )

    # El retriever recibe abstracciones.
    #
    # No conoce directamente:
    # - google.genai;
    # - Client;
    # - embed_content.
    retriever = (
        RagRetriever(
            llm_adapter=(
                gemini_adapter
            ),
            client=(
                gemini_client
            ),
            data_dir=(
                DATA_DIR
            ),
            embedding_model=(
                EMBEDDING_MODEL_GEMINI_NAME
            ),
        )
    )

    # El historial conserva un prompt base
    # estable.
    #
    # El contexto RAG real se genera
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
            MODEL_GEMINI_NAME
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

            Para cada pregunta:

            1. recupera contexto relevante;
            2. crea el system prompt del turno;
            3. crea el evaluador con la misma evidencia;
            4. ejecuta chat, tools y evaluación.
            """

            retrieved_context = (
                retriever.retrieve(
                    message
                )
            )

            turn_system_prompt = (
                build_system_prompt(
                    name=name,
                    retrieved_context=(
                        retrieved_context
                    ),
                )
            )

            # El evaluador recibe exactamente
            # las evidencias utilizadas para
            # generar la respuesta.
            evaluator_prompt = (
                build_evaluator_prompt(
                    name=name,
                    system_prompt=(
                        turn_system_prompt
                    ),
                )
            )

            # Se conserva una copia completa antes de iniciar
            # el turno.
            #
            # Gemini puede ejecutar correctamente una tool y fallar
            # después al continuar el protocolo técnico. En ese caso,
            # no deben persistirse mensajes assistant.tool_calls ni
            # mensajes role='tool' sin una respuesta final.
            history_before_turn = (
                deepcopy(
                    history
                )
            )

            try:
                return chat(
                    ask_chat_question=(
                        gemini_adapter
                        .ask_chat_question
                    ),
                    client=(
                        gemini_client
                    ),
                    model=(
                        MODEL_GEMINI_NAME
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

            except Exception:
                # Restaura el último estado conversacional válido.
                #
                # El efecto externo de una tool ya ejecutada
                # (por ejemplo, un correo enviado) no puede revertirse,
                # pero el historial no debe quedar técnicamente incompleto.
                history.clear()

                history.extend(
                    history_before_turn
                )

                # chat() puede haber guardado el historial antes
                # de que la excepción llegara a este punto.
                #
                # Se sobrescribe inmediatamente con la versión válida.
                save_history(
                    data_dir=(
                        DATA_DIR
                    ),
                    history=history,
                    history_file=(
                        HISTORY_FILE
                    ),
                )

                raise

        gr.ChatInterface(
            fn=gradio_chat,
            chatbot=chatbot,
        ).launch()

    finally:
        # chat() guarda después de cada turno.
        #
        # Este guardado adicional protege el
        # último estado cuando se cierra Gradio.
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