import json
import sys

from pathlib import Path
from typing import (
    Any,
    Literal,
    cast,
)

import gradio as gr

from gradio.components.chatbot import (
    Message,
    MessageDict,
)


# Permite importar los componentes compartidos.
LABS_DIR = (
    Path(__file__)
    .resolve()
    .parents[1]
)

sys.path.insert(
    0,
    str(LABS_DIR),
)


from config.openia.openai_client import (
    OpenAILlmClientAdapter,
)

from config.shared.read import (
    read_pdf,
    read_text_file,
)

from config.shared.types import (
    ChatMessage,
)


MODEL_OPENIA_NAME = (
    "gpt-5-nano"
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
    / "history.json"
)


GREETING_MESSAGE = (
    "Hola, soy Bilbo Bolsón.\n"
    "¿En qué te puedo ayudar?"
)


GradioRole = Literal[
    "user",
    "assistant",
]


def validate_persisted_history(
    persisted: object,
) -> list[ChatMessage]:
    """
    Valida la estructura mínima del historial.

    json.load() retorna datos externos sin tipos confiables.
    """

    if not isinstance(
        persisted,
        list,
    ):
        raise ValueError(
            "El historial debe ser "
            "una lista JSON."
        )

    result: list[
        ChatMessage
    ] = []

    for index, item in enumerate(
        cast(
            list[object],
            persisted,
        )
    ):
        if not isinstance(
            item,
            dict,
        ):
            raise ValueError(
                "El mensaje ubicado en "
                f"{index} no es un objeto."
            )

        data = cast(
            dict[str, object],
            item,
        )

        role = data.get(
            "role"
        )

        if not isinstance(
            role,
            str,
        ):
            raise ValueError(
                "El mensaje ubicado en "
                f"{index} no contiene role."
            )

        content = data.get(
            "content"
        )

        if (
            content is not None
            and not isinstance(
                content,
                str,
            )
        ):
            raise ValueError(
                "El mensaje ubicado en "
                f"{index} contiene "
                "content inválido."
            )

        result.append(
            cast(
                ChatMessage,
                data,
            )
        )

    return result


def build_initial_history(
    system_prompt: str,
) -> list[ChatMessage]:
    """
    Carga el historial existente o crea la conversación inicial.
    """

    history: list[
        ChatMessage
    ] = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    if HISTORY_FILE.exists():
        with open(
            HISTORY_FILE,
            "r",
            encoding="utf-8",
        ) as file:
            persisted_data: object = (
                json.load(
                    file
                )
            )

        persisted = (
            validate_persisted_history(
                persisted_data
            )
        )

        history.extend(
            item
            for item in persisted
            if (
                item.get(
                    "role"
                )
                != "system"
            )
        )

        return history

    history.append(
        {
            "role": "assistant",
            "model": (
                MODEL_OPENIA_NAME
            ),
            "content": (
                GREETING_MESSAGE
            ),
        }
    )

    return history


def build_chatbot_history(
    history: list[ChatMessage],
) -> list[
    MessageDict
    | Message
]:
    """
    Convierte el historial interno al formato visible de Gradio.
    """

    chatbot_history: list[
        MessageDict
        | Message
    ] = []

    for item in history:
        role = item.get(
            "role"
        )

        if role not in {
            "user",
            "assistant",
        }:
            continue

        content = item.get(
            "content"
        )

        if not isinstance(
            content,
            str,
        ):
            continue

        chatbot_history.append(
            MessageDict(
                role=cast(
                    GradioRole,
                    role,
                ),
                content=content,
            )
        )

    return chatbot_history


def save_history(
    history: list[ChatMessage],
) -> None:
    """
    Guarda el historial de la conversación.
    """

    if len(history) <= 1:
        return

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    with open(
        HISTORY_FILE,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            history,
            file,
            indent=4,
            ensure_ascii=False,
        )


def main() -> None:
    """
    Ejecuta un chatbot básico utilizando el adapter de OpenAI.

    El adapter retorna ChatTurnResult.

    Este laboratorio utiliza el contenido final mediante:

        result["content"]
    """

    openia_adapter = (
        OpenAILlmClientAdapter()
    )

    openia_client = (
        openia_adapter
        .create_client()
    )

    summary = read_text_file(
        DATA_DIR
        / "summary.txt"
    )

    cv = read_pdf(
        DATA_DIR
        / "CV_Bilbo_Bolson.pdf"
    )

    name = (
        "Bilbo Bolsón"
    )

    system_prompt = f"""
Estás actuando como {name}.

Tu responsabilidad es representar a {name} con la mayor
fidelidad posible durante toda la conversación.

Se proporciona información de referencia sobre su vida,
trayectoria, experiencias, personalidad, conocimientos
y contexto.

Utiliza únicamente esa información para responder y
mantener la coherencia del personaje.

Habla como {name} hablaría, respetando su personalidad,
forma de pensar, conocimientos, valores y experiencias.

Responde de manera natural y conversacional.

Mantén siempre el personaje.

Si la información necesaria no está disponible,
indícalo honestamente y mantén el personaje.

Nunca menciones que eres una inteligencia artificial.

## Información de referencia

{summary}

## Información adicional

{cv}

## Regla obligatoria

Responde únicamente usando la información incluida en
"Información de referencia" e "Información adicional".

No uses conocimiento externo.

Si una respuesta no consta en las fuentes, indícalo
honestamente y mantén el personaje.
""".strip()

    history = (
        build_initial_history(
            system_prompt
        )
    )

    def chat(
        message: str,
        _gradio_history: list[
            dict[
                str,
                Any,
            ]
        ],
    ) -> str:
        """
        Ejecuta un turno.

        No se configuran tools en este laboratorio.
        """

        result = (
            openia_adapter
            .ask_chat_question(
                client=openia_client,
                model=(
                    MODEL_OPENIA_NAME
                ),
                messages=history,
                role="user",
                question=message,
            )
        )

        reply = result[
            "content"
        ]

        save_history(
            history
        )

        return reply

    try:
        chatbot = gr.Chatbot(
            value=(
                build_chatbot_history(
                    history
                )
            ),
        )

        gr.ChatInterface(
            fn=chat,
            chatbot=chatbot,
        ).launch()

    finally:
        save_history(
            history
        )

        print(
            "Historial guardado."
        )


if __name__ == "__main__":
    main()