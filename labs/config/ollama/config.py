import os

from dotenv import load_dotenv


# Opciones específicas utilizadas por Ollama durante la generación.
#
# Se mantienen únicamente parámetros útiles para controlar:
#
# - variabilidad;
# - repetición;
# - longitud máxima de salida.
#
# num_ctx no se configura desde este diccionario porque el endpoint
# compatible con OpenAI no garantiza su aplicación.
#
# Si necesitas cambiar el contexto máximo, conviene crear un modelo
# derivado mediante un Modelfile.
OLLAMA_CHAT_OPTIONS: dict[str, object] = {
    "top_k": 30,
    "repeat_penalty": 1.1,
}


# Parámetros compatibles directamente con Chat Completions.
OLLAMA_TEMPERATURE = 0.1

OLLAMA_TOP_P = 0.7

OLLAMA_MAX_TOKENS = 512


# Errores técnicos que pueden resolverse mediante un nuevo intento.
#
# Los errores de:
#
# - historial;
# - validación;
# - tool calling;
# - modelo incompatible;
#
# deben propagarse inmediatamente.
RETRYABLE_STATUS_CODES: frozenset[int] = frozenset(
    {
        408,  # Request Timeout
        429,  # Too Many Requests
        500,  # Internal Server Error
        502,  # Bad Gateway
        503,  # Service Unavailable
        504,  # Gateway Timeout
    }
)


def load_ollama_host() -> str:
    """
    Obtiene la dirección del servidor local de Ollama.

    Ejemplo en .env:

        OLLAMA_HOST=http://localhost:11434
    """

    load_dotenv(
        override=True
    )

    host = os.getenv(
        "OLLAMA_HOST"
    )

    if not host:
        raise RuntimeError(
            "La variable OLLAMA_HOST "
            "no existe en .env"
        )

    return host