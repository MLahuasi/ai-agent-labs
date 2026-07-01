from typing import Any


record_user_details_schema: dict[str, Any] = {
    "name": "record_user_details",
    "description": (
        "Usa esta herramienta de forma obligatoria cuando el usuario quiera "
        "contactar, enviar un mensaje directo, coordinar por correo, hablar "
        "con Mauricio, preguntar por disponibilidad, consultar sobre el CV, "
        "ofrecer una oportunidad o dejar sus datos de contacto. "
        "Si el usuario proporciona un email junto con nombre o motivo, "
        "llama esta herramienta inmediatamente. No respondas con información "
        "general del perfil antes de registrar los datos."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "email": {
                "type": "string",
                "description": "Correo electrónico proporcionado por el usuario.",
            },
            "name": {
                "type": "string",
                "description": "Nombre del usuario, si lo proporciona.",
            },
            "notes": {
                "type": "string",
                "description": (
                    "Resumen breve del motivo de contacto usando el contexto "
                    "de la conversación."
                ),
            },
        },
        "required": ["email"],
        "additionalProperties": False,
    },
}


record_unknown_question_schema: dict[str, Any] = {
    "name": "record_unknown_question",
    "description": (
        "Usa esta herramienta cuando no puedas responder una pregunta con la "
        "información disponible en el contexto."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "Pregunta que no se pudo responder.",
            },
        },
        "required": ["question"],
        "additionalProperties": False,
    },
}


send_email_to_admin_schema: dict[str, Any] = {
    "name": "send_email_to_admin",
    "description": (
        "Usa esta herramienta solo cuando sea necesario enviar una notificación "
        "importante al administrador del chatbot."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "subject": {
                "type": "string",
                "description": "Asunto breve del correo.",
            },
            "message": {
                "type": "string",
                "description": "Contenido completo del correo.",
            },
        },
        "required": ["subject", "message"],
        "additionalProperties": False,
    },
}


TOOLS: list[dict[str, Any]] = [
    {"type": "function", "function": record_user_details_schema},
    {"type": "function", "function": record_unknown_question_schema},
    {"type": "function", "function": send_email_to_admin_schema},
]