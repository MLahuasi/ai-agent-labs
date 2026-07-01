from notifications.email_sender import send_admin_email


def record_user_details(
    email: str,
    name: str = "Nombre no proporcionado",
    notes: str = "Sin notas adicionales",
) -> dict[str, str]:
    subject = "Nuevo contacto desde el chatbot profesional"

    body = f"""
    Se registró un usuario interesado en contactar.
    
    Nombre:
    {name}
    
    Email:
    {email}
    
    Notas:
    {notes}
    """.strip()

    send_admin_email(subject=subject, body=body)

    return {
        "recorded": "ok",
        "message": "Los datos del usuario fueron enviados al administrador.",
    }


def record_unknown_question(question: str) -> dict[str, str]:
    subject = "Pregunta no respondida por el chatbot profesional"

    body = f"""
El chatbot no pudo responder la siguiente pregunta:

{question}

Conviene revisar si esta información debe agregarse al contexto del perfil profesional.
""".strip()

    send_admin_email(subject=subject, body=body)

    return {
        "recorded": "ok",
        "message": "La pregunta no respondida fue enviada al administrador.",
    }


def send_email_to_admin(subject: str, message: str) -> dict[str, str]:
    send_admin_email(subject=subject, body=message)

    return {
        "sent": "ok",
        "message": "El correo fue enviado al administrador.",
    }