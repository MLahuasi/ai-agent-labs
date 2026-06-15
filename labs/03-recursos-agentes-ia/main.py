import sys
import json
import gradio as gr

from pathlib import Path
from typing import Any

LABS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LABS_DIR))

from config.shared.types import ChatMessage
from config.openia.openai_client import create_openai_client, ask_chat_question as ask_openai_question

from pypdf import PdfReader

MODEL_OPENIA_NAME = "gpt-5-nano"
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
HISTORY_FILE = DATA_DIR / "history.json"

def main() -> None:
    openia_client = create_openai_client()

    reader = PdfReader(DATA_DIR / "CV_Bilbo_Bolson.pdf")
    cv = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            cv += text

    print(cv)

    with open(DATA_DIR / "summary.txt", "r", encoding="utf-8") as f:
        summary = f.read()

    name = "Bilbo Bolsón"

    system_prompt = f"""
    Estás actuando como {name}.

    Tu responsabilidad es representar a {name} con la mayor fidelidad posible durante toda la conversación.

    Se te proporciona información de referencia sobre la vida, trayectoria, experiencias, personalidad, conocimientos y contexto de {name}. Utiliza esa información para responder preguntas y mantener la coherencia del personaje.

    Habla como {name} hablaría, respetando su personalidad, forma de pensar, conocimientos, valores y experiencias.

    Responde de manera natural y conversacional, manteniendo siempre el personaje.

    Si la información necesaria para responder no está disponible o no forma parte del conocimiento de {name}, responde de forma honesta y coherente con el personaje.

    Nunca rompas el personaje ni menciones que eres una inteligencia artificial.

    ## Información de referencia:

    {summary}

    ## Información adicional:

    {cv}
    """

    system_prompt += (
        "\n\nRegla obligatoria: responde únicamente usando la información "
        "incluida en 'Información de referencia' e 'Información adicional'. "
        "No uses conocimiento externo. Si la respuesta no consta en esas fuentes, "
        "indícalo de forma honesta y manteniendo el personaje."
    )

    history: list[ChatMessage] = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]


    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r", encoding="utf-8") as file:
            persisted = json.load(file)

        history.extend(
            item
            for item in persisted
            if item["role"] != "system"
        )

    def chat(message: str, _gradio_history: list[dict[str, Any]]) -> str:
           
        response = ask_openai_question(
            client=openia_client,
            model=MODEL_OPENIA_NAME,
            messages=history,
            role="user",
            question=message,
        )


        if len(history) > 1:
            with open(HISTORY_FILE, "w", encoding="utf-8") as file:
                json.dump(
                    history,
                    file,
                    indent=4,
                    ensure_ascii=False,
                )


        return response
    
    try:
        gr.ChatInterface(fn=chat).launch()
    finally:
        if len(history) > 1:
            with open(HISTORY_FILE, "w", encoding="utf-8") as file:
                json.dump(
                    history,
                    file,
                    indent=4,
                    ensure_ascii=False,
                )

                print("Historial guardado.")


if __name__ == "__main__":
    main()
  
