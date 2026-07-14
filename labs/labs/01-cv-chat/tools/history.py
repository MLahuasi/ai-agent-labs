import json

from pathlib import Path
from typing import cast

from config.shared.types import (
    ChatMessage,
)

from settings.types import (
    ChatbotMessage,
)


VALID_CHAT_ROLES: set[str] = {
    "system",
    "user",
    "assistant",
    "tool",
}


def build_chatbot_history(
    history: list[ChatMessage],
) -> list[ChatbotMessage]:
    """
    Construye el historial visible utilizado por Gradio.

    No muestra:
    - system prompts;
    - resultados técnicos role="tool".
    """

    return [
        cast(
            ChatbotMessage,
            {
                "role": item["role"],
                "content": item.get(
                    "content"
                ),
            },
        )
        for item in history
        if item["role"]
        in {
            "user",
            "assistant",
        }
    ]


def validate_persisted_history(
    persisted: object,
) -> list[ChatMessage]:
    """
    Valida la estructura mínima del historial leído desde JSON.

    json.load() retorna información sin tipo estático confiable.

    Por ese motivo:

    1. se recibe object;
    2. se valida cada nivel;
    3. solamente después se realiza un cast controlado.
    """

    if not isinstance(
        persisted,
        list,
    ):
        raise ValueError(
            "El historial persistido debe "
            "ser una lista JSON."
        )

    # Después de verificar isinstance(..., list), indicamos
    # explícitamente que cada elemento todavía es un object.
    #
    # Esto elimina list[Unknown] en Pylance/Pyright.
    persisted_items = cast(
        list[object],
        persisted,
    )

    validated_history: list[
        ChatMessage
    ] = []

    for index, item in enumerate(
        persisted_items
    ):
        if not isinstance(
            item,
            dict,
        ):
            raise ValueError(
                "El mensaje del historial "
                f"en la posición {index} "
                "no es un objeto JSON."
            )

        # El contenido proveniente de JSON todavía no tiene
        # un esquema conocido.
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
                "El mensaje del historial "
                f"en la posición {index} "
                "no contiene un role válido."
            )

        if role not in VALID_CHAT_ROLES:
            raise ValueError(
                "El mensaje del historial "
                f"en la posición {index} "
                f"tiene un role desconocido: {role!r}."
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
                "El mensaje del historial "
                f"en la posición {index} "
                "contiene un content inválido."
            )

        # El objeto ya pasó las validaciones mínimas necesarias
        # para utilizarlo como ChatMessage.
        validated_history.append(
            cast(
                ChatMessage,
                item_data,
            )
        )

    return validated_history


def save_history(
    data_dir: Path,
    history_file: Path,
    history: list[ChatMessage],
) -> None:
    """
    Guarda el historial mediante escritura atómica.

    Primero genera un archivo temporal y únicamente reemplaza
    el archivo final cuando la escritura terminó correctamente.
    """

    data_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_file = (
        history_file.with_suffix(
            history_file.suffix
            + ".tmp"
        )
    )

    try:
        with open(
            temporary_file,
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                history,
                file,
                indent=4,
                ensure_ascii=False,
            )

            # Envía el buffer de Python al sistema operativo.
            file.flush()

        # Path.replace() reemplaza el archivo final únicamente
        # después de haber generado correctamente el temporal.
        temporary_file.replace(
            history_file
        )

    finally:
        # Elimina residuos temporales si ocurrió una excepción.
        if temporary_file.exists():
            temporary_file.unlink()


def load_history(
    history_file: Path,
    model_ia: str,
    greeting_message: str,
    system_prompt: str,
) -> list[ChatMessage]:
    """
    Carga el historial existente.

    Si todavía no existe, crea la conversación inicial.
    """

    if not history_file.exists():
        return [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "assistant",
                "model": model_ia,
                "content": greeting_message,
            },
        ]

    with open(
        history_file,
        "r",
        encoding="utf-8",
    ) as file:
        # Se conserva como object hasta completar las
        # validaciones de validate_persisted_history().
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
        item.get("role")
        == "system"
        for item in persisted
    )

    if has_system_prompt:
        return persisted

    return [
        {
            "role": "system",
            "content": system_prompt,
        },
        *persisted,
    ]