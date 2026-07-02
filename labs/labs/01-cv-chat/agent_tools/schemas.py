from typing import Any


def build_tools(person_name: str) -> list[dict[str, Any]]:
    record_user_details_schema: dict[str, Any] = {
        "name": "record_user_details",
        "description": (
            "Usa esta herramienta obligatoriamente cuando el usuario proporcione "
            "un correo electrónico y exprese intención de contacto, coordinación, "
            "seguimiento, contratación, colaboración, disponibilidad, conversación "
            "privada, consulta profesional, oportunidad laboral o deseo de que "
            f"{person_name} lo contacte. "
            "También úsala cuando el usuario deje nombre, correo electrónico y "
            "motivo de consulta, incluso si además realiza una pregunta técnica, "
            "pide más información sobre experiencia, tecnologías, proyectos, CV, "
            "disponibilidad o forma de trabajo. "
            "Si el usuario entrega sus datos después de haber preguntado cómo "
            "contactar, interpreta el mensaje como intención de contacto directo. "
            "Cuando esta herramienta aplica, debe ejecutarse antes de responder "
            "con información técnica o profesional extensa. "
            "Esta herramienta tiene prioridad sobre record_unknown_question y sobre "
            "una respuesta informativa normal cuando el mensaje contiene datos de "
            "contacto."
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
                        "Resumen breve y profesional del motivo de contacto usando "
                        "solo el contexto de la conversación. Si el usuario hace "
                        "una pregunta técnica junto con sus datos, resume esa "
                        "pregunta como motivo de consulta."
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
            "Usa esta herramienta obligatoriamente cuando el usuario haga una "
            f"pregunta que no pueda responderse honestamente con la información "
            f"disponible sobre {person_name}, su perfil, CV, LinkedIn o proyectos "
            "públicos de GitHub. Incluye preguntas sobre datos personales, datos "
            "familiares, preferencias, experiencias, fechas, clientes, estudios, "
            "certificaciones, cargos, métricas, proyectos o decisiones técnicas no "
            "documentadas. También úsala cuando la respuesta sea una negativa porque "
            "el dato es personal, familiar o sensible y no está documentado."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": (
                        "Pregunta exacta del usuario que no pudo responderse con "
                        "la información disponible."
                    ),
                },
            },
            "required": ["question"],
            "additionalProperties": False,
        },
    }

    send_email_to_admin_schema: dict[str, Any] = {
        "name": "send_email_to_admin",
        "description": (
            "Usa esta herramienta solo para enviar una notificación administrativa "
            "importante que no corresponda a registrar datos de contacto ni a "
            "registrar una pregunta no respondida. No la uses para conversaciones "
            "normales, consultas sobre el perfil, preguntas desconocidas ni datos "
            "de contacto."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "subject": {
                    "type": "string",
                    "description": "Asunto breve y claro del correo administrativo.",
                },
                "message": {
                    "type": "string",
                    "description": "Contenido completo de la notificación administrativa.",
                },
            },
            "required": ["subject", "message"],
            "additionalProperties": False,
        },
    }

    return [
        {"type": "function", "function": record_user_details_schema},
        {"type": "function", "function": record_unknown_question_schema},
        {"type": "function", "function": send_email_to_admin_schema},
    ]