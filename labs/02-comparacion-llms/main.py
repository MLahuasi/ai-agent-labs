import json
import sys

from pathlib import Path
from typing import cast


# Permite importar los adapters compartidos ubicados en labs/config.
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

from config.groq.groq_client import (
    GroqLlmClientAdapter,
)

from config.ollama.ollama_client import (
    OllamaLlmClientAdapter,
)

from config.openia.openai_client import (
    OpenAILlmClientAdapter,
)

from config.shared.types import (
    ChatMessage,
)


MODEL_OPENIA_NAME = (
    "gpt-5-nano"
)

MODEL_GEMINI_NAME = (
    "gemini-2.5-flash-lite"
)

MODEL_GROQ_NAME = (
    "llama-3.3-70b-versatile"
)

MODEL_OLLAMA_NAME_1 = (
    "qwen2.5-coder:3b"
)

MODEL_OLLAMA_NAME_2 = (
    "gemma3:4b"
)

MODEL_OLLAMA_NAME_3 = (
    "llama3.2"
)


def parse_ranking(
    raw_response: str,
    expected_competitors: int,
) -> list[int]:
    """
    Valida la respuesta JSON generada por el modelo juez.

    El formato esperado es:

        {
            "resultados": [1, 2, 3]
        }

    Se valida explícitamente la estructura porque json.loads()
    retorna datos externos sin tipos estáticos confiables.
    """

    try:
        parsed: object = json.loads(
            raw_response
        )

    except json.JSONDecodeError as error:
        raise ValueError(
            "El juez no devolvió JSON válido. "
            f"Detalle: {error.msg}"
        ) from error

    if not isinstance(
        parsed,
        dict,
    ):
        raise ValueError(
            "La respuesta del juez debe "
            "ser un objeto JSON."
        )

    payload = cast(
        dict[str, object],
        parsed,
    )

    results = payload.get(
        "resultados"
    )

    if not isinstance(
        results,
        list,
    ):
        raise ValueError(
            "La propiedad 'resultados' "
            "debe ser una lista."
        )

    normalized_results: list[int] = []

    for item in cast(
        list[object],
        results,
    ):
        if not isinstance(
            item,
            int,
        ):
            raise ValueError(
                "Todos los elementos de "
                "'resultados' deben ser enteros."
            )

        if (
            item < 1
            or item > expected_competitors
        ):
            raise ValueError(
                "El ranking contiene un índice "
                f"fuera de rango: {item}."
            )

        normalized_results.append(
            item
        )

    if (
        len(normalized_results)
        != expected_competitors
    ):
        raise ValueError(
            "El ranking no contiene "
            "todos los competidores."
        )

    if (
        len(set(normalized_results))
        != expected_competitors
    ):
        raise ValueError(
            "El ranking contiene "
            "competidores repetidos."
        )

    return normalized_results


def main() -> None:
    """
    Compara las respuestas generadas por varios modelos.

    Todos los adapters retornan ChatTurnResult.

    Este laboratorio utiliza únicamente:

        result["content"]

    porque no configura tools.
    """

    # ---------------------------------------------------------------------
    # Adapters
    # ---------------------------------------------------------------------

    openia_adapter = (
        OpenAILlmClientAdapter()
    )

    gemini_adapter = (
        GeminiLlmClientAdapter()
    )

    groq_adapter = (
        GroqLlmClientAdapter()
    )

    ollama_adapter = (
        OllamaLlmClientAdapter()
    )

    # ---------------------------------------------------------------------
    # Clientes
    # ---------------------------------------------------------------------

    openia_client = (
        openia_adapter
        .create_client()
    )

    gemini_client = (
        gemini_adapter
        .create_client()
    )

    groq_client = (
        groq_adapter
        .create_client()
    )

    ollama_client = (
        ollama_adapter
        .create_client()
    )

    limit = (
        "Responde en máximo 80 palabras."
    )

    request = (
        "Propón una única pregunta basada en una situación realista "
        "donde una persona deba tomar una decisión importante con "
        "recursos limitados. La situación debe incluir restricciones "
        "de tiempo, presupuesto o prioridades en conflicto. "
        "La pregunta debe ser autocontenida, no requerir conocimientos "
        "externos y poder responderse en menos de 150 palabras. "
        "Responde únicamente con la pregunta."
    )

    answers: list[
        tuple[str, str]
    ] = []

    # ---------------------------------------------------------------------
    # Generación de la pregunta
    # ---------------------------------------------------------------------

    print(
        "---- GENERA PREGUNTA A OPENIA ----"
    )

    prompt_history: list[
        ChatMessage
    ] = []

    prompt_result = (
        openia_adapter
        .ask_chat_question(
            client=openia_client,
            model=MODEL_OPENIA_NAME,
            messages=prompt_history,
            role="user",
            question=(
                f"{request}\n\n"
                f"{limit}"
            ),
        )
    )

    current_prompt = (
        prompt_result[
            "content"
        ]
    )

    print(
        current_prompt
    )

    # ---------------------------------------------------------------------
    # OpenAI
    # ---------------------------------------------------------------------

    print(
        "---- LLAMAR A OPENIA ----"
    )

    openia_history: list[
        ChatMessage
    ] = []

    openia_result = (
        openia_adapter
        .ask_chat_question(
            client=openia_client,
            model=MODEL_OPENIA_NAME,
            messages=openia_history,
            role="user",
            question=(
                f"{current_prompt}\n\n"
                f"{limit}"
            ),
        )
    )

    answers.append(
        (
            MODEL_OPENIA_NAME,
            openia_result[
                "content"
            ],
        )
    )

    # ---------------------------------------------------------------------
    # Gemini
    # ---------------------------------------------------------------------

    print(
        "---- LLAMAR A GEMINI ----"
    )

    gemini_history: list[
        ChatMessage
    ] = []

    gemini_result = (
        gemini_adapter
        .ask_chat_question(
            client=gemini_client,
            model=MODEL_GEMINI_NAME,
            messages=gemini_history,
            role="user",
            question=(
                f"{current_prompt}\n\n"
                f"{limit}"
            ),
        )
    )

    answers.append(
        (
            MODEL_GEMINI_NAME,
            gemini_result[
                "content"
            ],
        )
    )

    # ---------------------------------------------------------------------
    # Groq
    # ---------------------------------------------------------------------

    print(
        "---- LLAMAR A GROQ ----"
    )

    groq_history: list[
        ChatMessage
    ] = []

    groq_result = (
        groq_adapter
        .ask_chat_question(
            client=groq_client,
            model=MODEL_GROQ_NAME,
            messages=groq_history,
            role="user",
            question=(
                f"{current_prompt}\n\n"
                f"{limit}"
            ),
        )
    )

    answers.append(
        (
            MODEL_GROQ_NAME,
            groq_result[
                "content"
            ],
        )
    )

    # ---------------------------------------------------------------------
    # Ollama - modelo 1
    # ---------------------------------------------------------------------

    print(
        "---- LLAMAR A OLLAMA #1 ----"
    )

    ollama_history_1: list[
        ChatMessage
    ] = []

    ollama_result_1 = (
        ollama_adapter
        .ask_chat_question(
            client=ollama_client,
            model=MODEL_OLLAMA_NAME_1,
            messages=ollama_history_1,
            role="user",
            question=(
                f"{current_prompt}\n\n"
                f"{limit}"
            ),
        )
    )

    answers.append(
        (
            MODEL_OLLAMA_NAME_1,
            ollama_result_1[
                "content"
            ],
        )
    )

    # ---------------------------------------------------------------------
    # Ollama - modelo 2
    # ---------------------------------------------------------------------

    print(
        "---- LLAMAR A OLLAMA #2 ----"
    )

    ollama_history_2: list[
        ChatMessage
    ] = []

    ollama_result_2 = (
        ollama_adapter
        .ask_chat_question(
            client=ollama_client,
            model=MODEL_OLLAMA_NAME_2,
            messages=ollama_history_2,
            role="user",
            question=(
                f"{current_prompt}\n\n"
                f"{limit}"
            ),
        )
    )

    answers.append(
        (
            MODEL_OLLAMA_NAME_2,
            ollama_result_2[
                "content"
            ],
        )
    )

    # ---------------------------------------------------------------------
    # Ollama - modelo 3
    # ---------------------------------------------------------------------

    print(
        "---- LLAMAR A OLLAMA #3 ----"
    )

    ollama_history_3: list[
        ChatMessage
    ] = []

    ollama_result_3 = (
        ollama_adapter
        .ask_chat_question(
            client=ollama_client,
            model=MODEL_OLLAMA_NAME_3,
            messages=ollama_history_3,
            role="user",
            question=(
                f"{current_prompt}\n\n"
                f"{limit}"
            ),
        )
    )

    answers.append(
        (
            MODEL_OLLAMA_NAME_3,
            ollama_result_3[
                "content"
            ],
        )
    )

    # ---------------------------------------------------------------------
    # Mostrar respuestas
    # ---------------------------------------------------------------------

    print(
        "**** RESPUESTAS MODELOS *****"
    )

    for (
        model_name,
        model_answer,
    ) in answers:
        print(
            "----"
        )

        print(
            model_name
        )

        print(
            model_answer
        )

    # ---------------------------------------------------------------------
    # Construir evaluación
    # ---------------------------------------------------------------------

    competitors: list[str] = []

    for index, (
        model_name,
        answer,
    ) in enumerate(
        answers,
        start=1,
    ):
        competitors.append(
            (
                f"# Competidor {index}\n"
                f"Modelo: {model_name}\n"
                f"Respuesta: {answer}"
            )
        )

    together = (
        "\n\n".join(
            competitors
        )
    )

    expected_result = list(
        range(
            1,
            len(answers) + 1,
        )
    )

    judge_prompt = f"""
Estás evaluando respuestas a una misma pregunta.

Pregunta:

{current_prompt}

Evalúa cada respuesta por:

- calidad del razonamiento;
- manejo de restricciones;
- claridad;
- plan de acción.

Devuelve únicamente JSON válido.

No uses markdown.

No agregues explicaciones fuera del JSON.

Formato esperado:

{{"resultados": {expected_result}}}

El primer número representa al mejor competidor.

Cada competidor debe aparecer exactamente una vez.

Respuestas:

{together}
""".strip()

    # ---------------------------------------------------------------------
    # Juez OpenAI
    # ---------------------------------------------------------------------

    print(
        "---- LLAMAR A JUEZ OPENIA ----"
    )

    judge_history: list[
        ChatMessage
    ] = []

    judge_result = (
        openia_adapter
        .ask_chat_question(
            client=openia_client,
            model=MODEL_OPENIA_NAME,
            messages=judge_history,
            role="user",
            question=judge_prompt,
        )
    )

    judge_content = (
        judge_result[
            "content"
        ]
    )

    print(
        judge_content
    )

    ranking = parse_ranking(
        raw_response=judge_content,
        expected_competitors=(
            len(answers)
        ),
    )

    # ---------------------------------------------------------------------
    # Mostrar ranking
    # ---------------------------------------------------------------------

    print(
        "**** RANKING *****"
    )

    for position, (
        competitor_index
    ) in enumerate(
        ranking,
        start=1,
    ):
        answer_index = (
            competitor_index - 1
        )

        model_name = (
            answers[
                answer_index
            ][0]
        )

        print(
            f"Rank {position}: "
            f"{model_name}"
        )


if __name__ == "__main__":
    main()