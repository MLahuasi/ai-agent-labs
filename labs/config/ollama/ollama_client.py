from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import urlopen

from ollama import Client

from config.ollama.config import load_ollama_host


def create_ollama_client() -> Client:
    return Client(host=load_ollama_host())


def get_ollama_host() -> str:
    return load_ollama_host()


def _build_tags_url(host: str) -> str:
    normalized_host = host.rstrip("/")
    return f"{normalized_host}/api/tags"


def assert_ollama_server_available(host: str, timeout_seconds: float = 3.0) -> None:
    tags_url = _build_tags_url(host)

    try:
        with urlopen(tags_url, timeout=timeout_seconds) as response:
            status_code = getattr(response, "status", None)

            if status_code != 200:
                raise RuntimeError(
                    f"Ollama respondio con estado HTTP {status_code} en {tags_url}."
                )
    except HTTPError as error:
        raise RuntimeError(
            f"Ollama respondio con estado HTTP {error.code} en {tags_url}."
        ) from error
    except URLError as error:
        parsed = urlsplit(host)
        host_port = parsed.netloc or parsed.path or host
        raise RuntimeError(
            "No se pudo conectar al servidor de Ollama en "
            f"{host_port}. Verifica que el servicio este levantado y "
            "escuchando en ese host."
        ) from error
