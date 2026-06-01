from ollama import Client

from config.ollama.config import load_ollama_host


def create_ollama_client() -> Client:
    return Client(host=load_ollama_host())

