import sys
from typing import Any, cast
import gradio as gr
from gradio.components.chatbot import MessageDict, Message
from pathlib import Path


LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))


from config.shared.read import read_json_file, read_pdf, read_text_file
from prompts.system import build_system_prompt
from prompts.greeting import build_greeting_message
from prompts.evaluator import build_evaluator_prompt
from tools.history import build_chatbot_history, load_history, save_history
from tools.chat import chat

from config.groq.groq_client import GroqLlmClientAdapter

from agent_tools.schemas import build_tools
from agent_tools.tool_calls import handle_tool_calls


MODEL_GROQ_NAME = "llama-3.1-8b-instant"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

# Recomendado: usar historial separado para Groq
HISTORY_FILE = DATA_DIR / "history-evaluator-groq.json"


def main() -> None:
    groq_adapter = GroqLlmClientAdapter()
    groq_client = groq_adapter.create_client()

    name = "Mauricio Lahuasi"
    tools = build_tools(name)

    print(DATA_DIR)

    greeting = build_greeting_message(name)
    summary = read_text_file(DATA_DIR / "summary.txt")
    cv = read_pdf(DATA_DIR / "cv_2026.pdf")    
    github_projects = read_json_file(DATA_DIR / "github-projects-knowledge.json")

    system_prompt = build_system_prompt(
        cv=cv,
        github_projects=github_projects,        
        summary=summary,
        name=name,
    )

    evaluator_prompt = build_evaluator_prompt(
        name=name,
        system_prompt=system_prompt,
    )

    history = load_history(
        greeting_message=greeting,
        model_ia=MODEL_GROQ_NAME,
        system_prompt=system_prompt,
        history_file=HISTORY_FILE,
    )

    chatbot_history = build_chatbot_history(history=history)

    gradio_chatbot_history = cast(
        list[MessageDict | Message],
        chatbot_history,
    )

    try:
        chatbot = gr.Chatbot(
            value=gradio_chatbot_history,
        )

        def gradio_chat(
            message: str,
            gradio_history: list[dict[str, Any]],
        ) -> str:
            return chat(
                ask_chat_question=groq_adapter.ask_chat_question,
                client=groq_client,
                model=MODEL_GROQ_NAME,
                system_prompt=system_prompt,
                evaluator_prompt=evaluator_prompt,
                history=history,
                data_dir=DATA_DIR,
                history_file=HISTORY_FILE,
                message=message,
                _gradio_history=gradio_history,
                tools=tools,
                handle_tool_calls=handle_tool_calls,
            )

        gr.ChatInterface(
            fn=gradio_chat,
            chatbot=chatbot,
        ).launch()

    finally:
        save_history(
            data_dir=DATA_DIR,
            history=history,
            history_file=HISTORY_FILE,
        )
        print("Historial guardado.")


if __name__ == "__main__":
    main()