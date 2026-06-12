import sys
import json
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LABS_DIR))

from config.shared.types import ChatMessage
from config.openia.openai_client import create_openai_client, ask_chat_question as ask_openai_question
from config.gemini.gemini_client import create_gemini_client, ask_chat_question as ask_gemini_question
from config.ollama.ollama_client import create_ollama_client, ask_chat_question as ask_ollama_question
from config.groq.groq_client import create_groq_client, ask_chat_question as ask_groq_question


MODEL_OPENIA_NAME = "gpt-5-nano"
MODEL_GEMINI_NAME = "gemini-2.5-flash-lite"
MODEL_OLLAMA_NAME_1 = "qwen2.5-coder:3b"
MODEL_OLLAMA_NAME_2 = "gemma3:4b"
MODEL_OLLAMA_NAME_3 = "llama3.2"
MODEL_GROQ_NAME = "llama-3.3-70b-versatile"


def main() -> None:
    openia_client = create_openai_client()
    gemini_client = create_gemini_client()
    ollama_client = create_ollama_client()
    groq_client = create_groq_client()

    limit = (
        "Responde en máximo 80 palabras. "
    )

    request = (
        "Propón una única pregunta basada en una situación realista donde una "
        "persona deba tomar una decisión importante con recursos limitados. "
        "La situación debe incluir restricciones de tiempo, presupuesto o "
        "prioridades en conflicto. La pregunta debe ser autocontenida, no "
        "requerir conocimientos externos y poder responderse en menos de "
        "150 palabras. Responde únicamente con la pregunta."
    )
    history: list[ChatMessage] = []
    answers: list[tuple[str, str]] = []

    print("---- GENERA PREGUNTA A OPENIA ----")
    current_prompt = ask_openai_question(
        client=openia_client,
        model=MODEL_OPENIA_NAME,
        messages=history,
        role="user",
        question=f"{request}\n\n{limit}",
    )
    print(current_prompt)    
    
    # LLAMA LLM#1
    print("---- LLAMAR A OPENIA ----")
    answer = ask_openai_question(
        client=openia_client,
        model=MODEL_OPENIA_NAME,
        messages=history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )
    # print(answer)    
    answers.append((MODEL_OPENIA_NAME, answer))

    # LLAMA LLM#2
    print("---- LLAMAR A GEMINI ----")
    answer = ask_gemini_question(
        client=gemini_client,
        model=MODEL_GEMINI_NAME,
        messages=history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )
    # print(answer)
    answers.append((MODEL_GEMINI_NAME, answer))

    # LLAMA LLM#3
    print("---- LLAMAR A GROQ ----")
    answer = ask_groq_question(
        client=groq_client,
        model=MODEL_GROQ_NAME,
        messages=history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )
    # print(answer)
    answers.append((MODEL_GROQ_NAME, answer))
    
    # LLAMA LLM#4
    print("---- LLAMAR A OLLAMA #1 ----")
    answer = ask_ollama_question(
        client=ollama_client,
        model=MODEL_OLLAMA_NAME_1,
        messages=history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )
    # print(answer)
    answers.append((MODEL_OLLAMA_NAME_1, answer))

    # LLAMA LLM#5
    print("---- LLAMAR A OLLAMA #2 ----")
    answer = ask_ollama_question(
        client=ollama_client,
        model=MODEL_OLLAMA_NAME_2,
        messages=history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )
    # print(answer)
    answers.append((MODEL_OLLAMA_NAME_2, answer))

    print("---- LLAMAR A OLLAMA #3 ----")
    answer = ask_ollama_question(
        client=ollama_client,
        model=MODEL_OLLAMA_NAME_3,
        messages=history,
        role="user",
        question=f"{current_prompt}\n\n{limit}",
    )
    # print(answer)
    answers.append((MODEL_OLLAMA_NAME_3, answer))

    # print("**** RESPUESTAS MODELOS *****")
    # for model_name, model_answer in answers:
    #     print(model_name)
    #     print(model_answer)

    # History
    print("**** HISTORIAL CHAT ORQUESTACION MULTIPLE *****")
    print(history)

    # Comparación entre modelos:
    together = ""

    for index, (model_name, answer) in enumerate(answers, start=1):
        together += f"# Competidor {index}\n"
        together += f"Modelo: {model_name}\n"
        together += f"Respuesta: {answer}\n\n"

    # Crear prompt para evaluar
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

    Devuelve únicamente JSON:

    {{"resultados": {expected_result}}}

    donde 1 es el mejor competidor.

    Respuestas:

    {together}
    """    

    # Llamar al juez
    judge_history: list[ChatMessage] = []

    judge_result = ask_openai_question(
        client=openia_client,
        model=MODEL_OPENIA_NAME,
        messages=judge_history,
        role="user",
        question=judge_prompt,
    )

    print(judge_result)

    # Mostrar Ranking    

    ranking = json.loads(judge_result)
    results = ranking.get("resultados", [])

    print("**** RANKING *****")

    for position, competitor_index in enumerate(results, start=1):
        index = int(competitor_index) - 1
        model_name = answers[index][0]

        print(f"Rank {position}: {model_name}")

if __name__ == "__main__":
    main()
