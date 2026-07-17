import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv


def get_required_env(name: str) -> str:
    value = os.getenv(name)

    if value is None or not value.strip():
        raise RuntimeError(f"La variable de entorno {name} no está configurada.")

    return value.strip()


def send_admin_email(subject: str, body: str) -> None:
    load_dotenv(override=True)

    mailer_email = get_required_env("MAILER_EMAIL")
    mailer_secret_key = get_required_env("MAILER_SECRET_KEY")
    admin_email = get_required_env("MAILER_ADMIN_EMAIL")

    mailer_host = os.getenv("MAILER_HOST", "smtp.gmail.com")
    mailer_port = int(os.getenv("MAILER_PORT", "587"))

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = mailer_email
    message["To"] = admin_email
    message.set_content(body)

    with smtplib.SMTP(mailer_host, mailer_port, timeout=15) as server:
        server.starttls()
        server.login(mailer_email, mailer_secret_key)
        server.send_message(message)