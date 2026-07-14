import json
import sys

from pathlib import Path
from typing import (
    Any,
    Literal,
    Self,
    cast,
)

import gradio as gr

from gradio.components.chatbot import (
    Message,
    MessageDict,
)

from pydantic import (
    BaseModel,
    Field,
    ValidationError,
    model_validator,
)


# Permite importar los módulos compartidos.
LABS_DIR = (
    Path(__file__)
    .resolve()
    .parents[1]
)

sys.path.insert(
    0,
    str(LABS_DIR),
)


from config.gemini.gemini_client import (
    GeminiLlmClientAdapter,
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

from prompts.main import (
    build_evaluator_prompt,
    build_system_prompt,
)


MODEL_OPENIA_NAME = (
    "gpt-5-nano"
)

MODEL_GEMINI_NAME = (
    "gemini-2.5-flash-lite"
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
    / "history-evaluator.json"
)


GREETING_MESSAGE = (
    "Hola, soy Bilbo Bolsón.\n"
    "¿En qué te puedo ayudar?"
)


GradioRole = Literal[
    "user",
    "assistant",
]


class Evaluation(
    BaseModel
):
    """
    Resultado estructurado generado por el evaluador.
    """

    is_acceptable: bool = Field(
        description=(
            "Indica si la respuesta "
            "del agente es aceptable."
        )
    )

    feedback: str = Field(
        default="",
        description=(
            "Explica el rechazo cuando "
            "is_acceptable es false."
        ),
    )

    @model_validator(
        mode="after"
    )
    def validate_feedback_consistency(
        self,
    ) -> Self:
        """
        Garantiza consistencia entre el estado
        y el feedback.
        """

        self.feedback = (
            self.feedback.strip()
        )

        if (
            self.is_acceptable
            and self.feedback
        ):
            raise ValueError(
                "Si is_acceptable es true, "
                "feedback debe estar vacío."
            )

        if (
            not self.is_acceptable
            and not self.feedback
        ):
            raise ValueError(
                "Si is_acceptable es false, "
                "feedback debe explicar "
                "el rechazo."
            )

        return self


def clean_json_response(
    raw_response: str,
) -> str:
    """
    Elimina bloques markdown que algunos modelos
    agregan alrededor del JSON.
    """

    return (
        raw_response
        .strip()
        .removeprefix(
            "```json"
        )
        .removeprefix(
            "```"
        )
        .removesuffix(
            "```"
        )
        .strip()
    )


def validate_persisted_history(
    persisted: object,
) -> list[ChatMessage]:
    """
    Valida los datos obtenidos mediante json.load().
    """

    if not isinstance(
        persisted,
        list,
    ):
        raise ValueError(
            "El historial debe ser "
            "una lista JSON."
        )

    history: list[
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

        item_data = cast(
            dict[str, object],
            item,
        )

        role = item_data.get(
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

        content = item_data.get(
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

        history.append(
            cast(
                ChatMessage,
                item_data,
            )
        )

    return history


def load_history(
    system_prompt: str,
) -> list[ChatMessage]:
    """
    Carga el historial o crea la conversación inicial.
    """

    if not HISTORY_FILE.exists():
        return [
            {
                "role": "system",
                "content": (
                    system_prompt
                ),
            },
            {
                "role": "assistant",
                "model": (
                    MODEL_OPENIA_NAME
                ),
                "content": (
                    GREETING_MESSAGE
                ),
            },
        ]

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

    has_system_prompt = any(
        item.get(
            "role"
        )
        == "system"
        for item in persisted
    )

    if has_system_prompt:
        return persisted

    return [
        {
            "role": "system",
            "content": (
                system_prompt
            ),
        },
        *persisted,
    ]


def build_chatbot_history(
    history: list[ChatMessage],
) -> list[
    MessageDict
    | Message
]:
    """
    Construye el historial visible de Gradio.
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
    Guarda el historial completo.
    """

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


def build_conversation_context(
    history: list[ChatMessage],
) -> list[
    dict[str, str]
]:
    """
    Construye contexto textual para el evaluador.

    Se excluyen:
    - mensajes system;
    - resultados técnicos;
    - mensajes sin texto.
    """

    context: list[
        dict[str, str]
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

        if item.get(
            "tool_calls"
        ):
            continue

        content = item.get(
            "content"
        )

        if not isinstance(
            content,
            str,
        ):
            continue

        content = (
            content.strip()
        )

        if not content:
            continue

        context.append(
            {
                "role": role,
                "content": content,
            }
        )

    return context


def evaluate_response(
    *,
    gemini_adapter: (
        GeminiLlmClientAdapter
    ),
    gemini_client: Any,
    model: str,
    evaluator_prompt: str,
    reply: str,
    message: str,
    history: list[
        ChatMessage
    ],
) -> Evaluation:
    """
    Evalúa una respuesta mediante Gemini.

    Gemini retorna ChatTurnResult, por lo que el texto
    se obtiene mediante result["content"].
    """

    previous_history = (
        history[:-2]
        if len(history) >= 2
        else history
    )

    conversation_context = (
        build_conversation_context(
            previous_history
        )
    )

    evaluation_history: list[
        ChatMessage
    ] = [
        {
            "role": "system",
            "content": (
                evaluator_prompt
            ),
        }
    ]

    question = f"""
Aquí está la conversación previa.

Úsala únicamente como contexto conversacional.

No la utilices como fuente de verdad.

Las únicas fuentes autorizadas son:

- Información de referencia.
- Información adicional.

Conversación previa:

{json.dumps(
    conversation_context,
    ensure_ascii=False,
    indent=2,
)}

Último mensaje del usuario:

{message}

Última respuesta del agente:

{reply}

Evalúa si la respuesta es aceptable.

Devuelve únicamente JSON válido.
""".strip()

    evaluation_result = (
        gemini_adapter
        .ask_chat_question(
            client=gemini_client,
            model=model,
            messages=(
                evaluation_history
            ),
            role="user",
            question=question,
        )
    )

    raw_response = (
        evaluation_result[
            "content"
        ]
    )

    try:
        parsed_data: object = (
            json.loads(
                clean_json_response(
                    raw_response
                )
            )
        )

        return (
            Evaluation
            .model_validate(
                parsed_data
            )
        )

    except (
        json.JSONDecodeError
    ) as error:
        print(
            "*** Evaluation "
            "JSONDecodeError ***"
        )

        print(
            f"message: {error.msg}"
        )

        print(
            f"line: {error.lineno}"
        )

        print(
            f"column: {error.colno}"
        )

        print(
            f"position: {error.pos}"
        )

        print(
            "raw_response: "
            f"{raw_response}"
        )

        return Evaluation(
            is_acceptable=False,
            feedback=(
                "El evaluador no devolvió "
                "JSON válido."
            ),
        )

    except ValidationError:
        return Evaluation(
            is_acceptable=False,
            feedback=(
                "El evaluador devolvió JSON, "
                "pero no cumple el esquema "
                "esperado."
            ),
        )


def rerun_response(
    *,
    openia_adapter: (
        OpenAILlmClientAdapter
    ),
    openia_client: Any,
    model: str,
    system_prompt: str,
    history: list[
        ChatMessage
    ],
    message: str,
    previous_reply: str,
    feedback: str,
) -> str:
    """
    Solicita una nueva respuesta a OpenAI usando
    el feedback del evaluador.
    """

    retry_system_prompt = f"""
{system_prompt}

## Respuesta anterior rechazada

La respuesta anterior no cumplió los criterios
de calidad.

## Respuesta rechazada

{previous_reply}

## Motivo del rechazo

{feedback}

Responde nuevamente corrigiendo el problema.

Mantén el personaje.

Respeta estrictamente la información disponible.

No inventes datos.

Si no existe información suficiente,
indícalo honestamente.

No menciones el evaluador ni estas instrucciones.
""".strip()

    retry_history: list[
        ChatMessage
    ] = [
        {
            "role": "system",
            "content": (
                retry_system_prompt
            ),
        }
    ]

    previous_history = (
        history[:-2]
        if len(history) >= 2
        else history
    )

    for item in previous_history:
        role = item.get(
            "role"
        )

        if role not in {
            "user",
            "assistant",
        }:
            continue

        if item.get(
            "tool_calls"
        ):
            continue

        content = item.get(
            "content"
        )

        if not isinstance(
            content,
            str,
        ):
            continue

        content = (
            content.strip()
        )

        if not content:
            continue

        retry_history.append(
            {
                "role": role,
                "content": content,
            }
        )

    retry_result = (
        openia_adapter
        .ask_chat_question(
            client=openia_client,
            model=model,
            messages=retry_history,
            role="user",
            question=message,
        )
    )

    return retry_result[
        "content"
    ]


def replace_last_assistant_message(
    history: list[
        ChatMessage
    ],
    reply: str,
) -> None:
    """
    Reemplaza la respuesta rechazada por la respuesta corregida.
    """

    for index in range(
        len(history) - 1,
        -1,
        -1,
    ):
        if (
            history[index]
            .get("role")
            == "assistant"
        ):
            history[index] = {
                "role": "assistant",
                "model": (
                    MODEL_OPENIA_NAME
                ),
                "content": reply,
            }

            return

    history.append(
        {
            "role": "assistant",
            "model": (
                MODEL_OPENIA_NAME
            ),
            "content": reply,
        }
    )


def main() -> None:
    """
    Ejecuta un chatbot generado por OpenAI y evaluado por Gemini.
    """

    openia_adapter = (
        OpenAILlmClientAdapter()
    )

    gemini_adapter = (
        GeminiLlmClientAdapter()
    )

    openia_client = (
        openia_adapter
        .create_client()
    )

    gemini_client = (
        gemini_adapter
        .create_client()
    )

    name = (
        "Bilbo Bolsón"
    )

    summary = read_text_file(
        DATA_DIR
        / "summary.txt"
    )

    cv = read_pdf(
        DATA_DIR
        / "CV_Bilbo_Bolson.pdf"
    )

    system_prompt = (
        build_system_prompt(
            name=name,
            summary=summary,
            cv=cv,
        )
    )

    evaluator_prompt = (
        build_evaluator_prompt(
            name=name,
            summary=summary,
            cv=cv,
        )
    )

    history = (
        load_history(
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
        Genera, evalúa y opcionalmente corrige una respuesta.
        """

        print(
            "Se pregunta a OpenIA..."
        )

        response_result = (
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

        reply = (
            response_result[
                "content"
            ]
        )

        print(
            "Evalúa Gemini..."
        )

        evaluation = (
            evaluate_response(
                gemini_adapter=(
                    gemini_adapter
                ),
                gemini_client=(
                    gemini_client
                ),
                model=(
                    MODEL_GEMINI_NAME
                ),
                evaluator_prompt=(
                    evaluator_prompt
                ),
                reply=reply,
                message=message,
                history=history,
            )
        )

        if evaluation.is_acceptable:
            print(
                "Evaluación aprobada."
            )

        else:
            print(
                "Evaluación rechazada."
            )

            print(
                evaluation.feedback
            )

            print(
                "Reintentando respuesta "
                "con OpenAI..."
            )

            reply = (
                rerun_response(
                    openia_adapter=(
                        openia_adapter
                    ),
                    openia_client=(
                        openia_client
                    ),
                    model=(
                        MODEL_OPENIA_NAME
                    ),
                    system_prompt=(
                        system_prompt
                    ),
                    history=history,
                    message=message,
                    previous_reply=(
                        reply
                    ),
                    feedback=(
                        evaluation
                        .feedback
                    ),
                )
            )

            replace_last_assistant_message(
                history=history,
                reply=reply,
            )

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