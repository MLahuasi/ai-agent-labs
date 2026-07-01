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

from config.openia.openai_client import OpenAILlmClientAdapter

from agent_tools.schemas import TOOLS
from agent_tools.registry import AVAILABLE_TOOLS
from tools.tool_calls import create_handle_tool_calls


MODEL_OPENIA_NAME = "gpt-5-nano"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
HISTORY_FILE = DATA_DIR / "history-evaluator.json"


def main() -> None:
    openia_adapter = OpenAILlmClientAdapter()
    openia_client = openia_adapter.create_client()

    handle_tool_calls = create_handle_tool_calls(AVAILABLE_TOOLS)

    name = "Mauricio Lahuasi"

    print(DATA_DIR)

    greeting = build_greeting_message(name)
    summary = read_text_file(DATA_DIR / "summary.txt")
    cv = read_pdf(DATA_DIR / "cv_ml.pdf")
    linkedin = read_pdf(DATA_DIR / "cv-ml-linkedIn.pdf")
    github_projects = read_json_file(DATA_DIR / "github-projects-knowledge.json")

    system_prompt = build_system_prompt(
        cv=cv,
        github_projects=github_projects,
        linkedin=linkedin,
        summary=summary,
        name=name,
    )

    evaluator_prompt = build_evaluator_prompt(
        name=name,
        system_prompt=system_prompt,
    )

    history = load_history(
        greeting_message=greeting,
        model_ia=MODEL_OPENIA_NAME,
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
                ask_chat_question=openia_adapter.ask_chat_question,
                client=openia_client,
                model=MODEL_OPENIA_NAME,
                system_prompt=system_prompt,
                evaluator_prompt=evaluator_prompt,
                history=history,
                data_dir=DATA_DIR,
                history_file=HISTORY_FILE,
                message=message,
                _gradio_history=gradio_history,
                tools=TOOLS,
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