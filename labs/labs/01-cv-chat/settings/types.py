from typing import Literal, TypedDict, Self
from pydantic import BaseModel, Field, model_validator

GradioRole = Literal["user", "assistant"]

class ChatbotMessage(TypedDict):
    role: GradioRole
    content: str


class Evaluation(BaseModel):
    is_acceptable: bool = Field(
        description="Indica si la respuesta del agente es aceptable."
    )
    feedback: str = Field(
        default="",
        description="Explica el rechazo cuando is_acceptable es false."
    )

    @model_validator(mode="after")
    def validate_feedback_consistency(self) -> Self:
        
        self.feedback = self.feedback.strip()

        if self.is_acceptable and self.feedback:
            raise ValueError(
                "Si is_acceptable es true, feedback debe estar vacío."
            )

        if not self.is_acceptable and not self.feedback:
            raise ValueError(
                "Si is_acceptable es false, feedback debe explicar el rechazo."
            )

        return self