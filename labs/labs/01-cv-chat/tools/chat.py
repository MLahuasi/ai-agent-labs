from typing import Any
from pathlib import Path

from config.shared.question import AskChatQuestion
from config.shared.types import ChatMessage
from tools.response import evaluate_response, rerun_response
from tools.history import save_history

def chat(
        ask_chat_question: AskChatQuestion, 
        client: Any,
        model: str,
        system_prompt:str,
        evaluator_prompt: str,
        history: list[ChatMessage],
        data_dir:Path, 
        history_file:Path, 
        message: str, 
        _gradio_history: list[dict[str, Any]]
    ) -> str:
    # print(f"Se pregunta al modelo {model} ...")
    reply = ask_chat_question(
        client=client,
        model=model,
        messages=history,
        role="user",
        question=message,
    )

    # print(f"{model} responde: {reply}")
    
    evaluation = evaluate_response(   
        ask_chat_question=ask_chat_question,
        client=client,         
        model=model,
        evaluator_prompt=evaluator_prompt,
        reply=reply,
        message=message,
        history=history,
    )

    print(f"Evaluación: acceptable: {evaluation.is_acceptable} - feedback: {evaluation.feedback}")


    if evaluation.is_acceptable:
        print("Evaluación aprobada.")
    else:
        print("Evaluación rechazada.")
        print(evaluation.feedback)
        print(f"Reintentando respuesta con modelo {model}...")
        reply = rerun_response(
                client=client,
                ask_chat_question=ask_chat_question,
                model=model,
                system_prompt=system_prompt,
                history=history,
                message=message,
                previous_reply=reply,
                feedback=evaluation.feedback,
            )

        history[-1] = {
            "role": "assistant",
            "model": model,
            "content": reply,
        }
    save_history(
        history=history,
        data_dir=data_dir,
        history_file=history_file
    )
    return reply