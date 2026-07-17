import os

from dotenv import load_dotenv


def load_gemini_api_key() -> str:
    """
    Carga la API key utilizada por Gemini.

    La validación permanece en la configuración del proveedor
    y no se filtra hacia la lógica del chatbot.
    """

    load_dotenv(
        override=True
    )

    api_key = os.getenv(
        "GEMINI_API_KEY"
    )

    if not api_key:
        raise RuntimeError(
            "La variable GEMINI_API_KEY "
            "no existe en .env"
        )

    return api_key


# Solo se reintentan errores temporales del proveedor.
#
# Los errores de validación, historial o programación
# deben propagarse inmediatamente.
RETRYABLE_STATUS_CODES: frozenset[int] = (
    frozenset(
        {
            429,
            500,
            502,
            503,
            504,
        }
    )
)