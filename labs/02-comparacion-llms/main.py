import sys
import json
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LABS_DIR))

from config.shared.types import ChatMessage

from config.openia.openai_client import OpenAILlmClientAdapter
from config.gemini.gemini_client import GeminiLlmClientAdapter
from config.ollama.ollama_client import OllamaLlmClientAdapter
from config.groq.groq_client import GroqLlmClientAdapter


MODEL_OPENIA_NAME = "gpt-5-nano"
MODEL_GEMINI_NAME = "gemini-2.5-flash-lite"
MODEL_OLLAMA_NAME_1 = "qwen2.5-coder:3b"
MODEL_OLLAMA_NAME_2 = "gemma3:4b"
MODEL_OLLAMA_NAME_3 = "llama3.2"
MODEL_GROQ_NAME = "llama-3.3-70b-versatile"


def main() -> None:
    openia_adapter = OpenAILlmClientAdapter()
    gemini_adapter = GeminiLlmClientAdapter()
    ollama_adapter = OllamaLlmClientAdapter()
    groq_adapter = GroqLlmClientAdapter()

    openia_client = openia_adapter.create_client()
    gemini_client = gemini_adapter.create_client()
    ollama_client = ollama_adapter.create_client()
    groq_client = groq_adapter.create_client()

    limit = "Responde en máximo 80 palabras."

    request = (
        "Propón una única pregunta basada en una situación realista donde una "
        "persona deba tomar una decisión importante con recursos limitados. "
        "La situación debe incluir restricciones de tiempo, presupuesto o "
        "prioridades en conflicto. La pregunta debe ser autocontenida, no "
        "requerir conocimientos externos y poder responderse en menos de "
        "150 palabras. Responde únicamente con la pregunta."
    )

    answers: list[tuple[str, str]] = []

    print("---- GENERA PREGUNTA A OPENIA ----")

    prompt_history: list[ChatMessage] = []

    current_prompt = openia_adapter.ask_chat_question(
        client=openia_client,
        model=MODEL_OPENIA_NAME,
        messages=prompt_history,
        role="user",
        question=f"{request}\n\n{limit}",
    )

    print(current_prompt)

    # LLAMA LLM #1 - OPENAI
    print("---- LLAMAR A OPENIA ----")

    openia_history: list[ChatMessage] = []

    answer = openia_adapter.ask_chat_question(
        client=openia_client,
        model=MODEL_OPENIA_NAME,
        messages=openia_history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )

    answers.append((MODEL_OPENIA_NAME, answer))

    # LLAMA LLM #2 - GEMINI
    print("---- LLAMAR A GEMINI ----")

    gemini_history: list[ChatMessage] = []

    answer = gemini_adapter.ask_chat_question(
        client=gemini_client,
        model=MODEL_GEMINI_NAME,
        messages=gemini_history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )

    answers.append((MODEL_GEMINI_NAME, answer))

    # LLAMA LLM #3 - GROQ
    print("---- LLAMAR A GROQ ----")

    groq_history: list[ChatMessage] = []

    answer = groq_adapter.ask_chat_question(
        client=groq_client,
        model=MODEL_GROQ_NAME,
        messages=groq_history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )

    answers.append((MODEL_GROQ_NAME, answer))

    # LLAMA LLM #4 - OLLAMA #1
    print("---- LLAMAR A OLLAMA #1 ----")

    ollama_history_1: list[ChatMessage] = []

    answer = ollama_adapter.ask_chat_question(
        client=ollama_client,
        model=MODEL_OLLAMA_NAME_1,
        messages=ollama_history_1,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )

    answers.append((MODEL_OLLAMA_NAME_1, answer))

    # LLAMA LLM #5 - OLLAMA #2
    print("---- LLAMAR A OLLAMA #2 ----")

    ollama_history_2: list[ChatMessage] = []

    answer = ollama_adapter.ask_chat_question(
        client=ollama_client,
        model=MODEL_OLLAMA_NAME_2,
        messages=ollama_history_2,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )

    answers.append((MODEL_OLLAMA_NAME_2, answer))

    # LLAMA LLM #6 - OLLAMA #3
    print("---- LLAMAR A OLLAMA #3 ----")

    ollama_history_3: list[ChatMessage] = []

    answer = ollama_adapter.ask_chat_question(
        client=ollama_client,
        model=MODEL_OLLAMA_NAME_3,
        messages=ollama_history_3,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )

    answers.append((MODEL_OLLAMA_NAME_3, answer))

    print("**** RESPUESTAS MODELOS *****")

    for model_name, model_answer in answers:
        print("----")
        print(model_name)
        print(model_answer)

    together = ""

    for index, (model_name, answer) in enumerate(answers, start=1):
        together += f"# Competidor {index}\n"
        together += f"Modelo: {model_name}\n"
        together += f"Respuesta: {answer}\n\n"

    expected_result = list(range(1, len(answers) + 1))

    judge_prompt = f"""
Estás evaluando respuestas a una misma pregunta.

Pregunta:

{current_prompt}

Evalúa cada respuesta por:

- calidad del razonamiento
- manejo de restricciones
- claridad
- plan de acción

Devuelve únicamente JSON válido, sin markdown, sin explicación adicional.

Formato esperado:

{{"resultados": {expected_result}}}

Donde el primer número representa al mejor competidor.

Respuestas:

{together}
"""

    print("---- LLAMAR A JUEZ OPENIA ----")

    judge_history: list[ChatMessage] = []

    judge_result = openia_adapter.ask_chat_question(
        client=openia_client,
        model=MODEL_OPENIA_NAME,
        messages=judge_history,
        role="user",
        question=judge_prompt,
    )

    print(judge_result)

    ranking = json.loads(judge_result)
    results = ranking.get("resultados", [])

    print("**** RANKING *****")

    for position, competitor_index in enumerate(results, start=1):
        index = int(competitor_index) - 1

        if index < 0 or index >= len(answers):
            print(f"Rank {position}: índice inválido {competitor_index}")
            continue

        model_name = answers[index][0]

        print(f"Rank {position}: {model_name}")


if __name__ == "__main__":
    main()