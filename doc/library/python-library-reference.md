# Referencia de Librerias Python

Esta referencia documenta las librerias usadas en los laboratorios Python del proyecto.

## Biblioteca Estandar

### `os`

**Que hace:** permite interactuar con el sistema operativo. En el laboratorio se usa para leer variables de entorno con `os.getenv()`.

**Cuando se usa:** cuando una aplicacion necesita leer configuracion del entorno, rutas, informacion del proceso o valores definidos fuera del codigo.

**Ejemplo:**

```python
import os

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("Falta GEMINI_API_KEY")
```

### `time`

**Que hace:** ofrece funciones relacionadas con tiempo. En el laboratorio se usa `time.sleep()` para esperar antes de reintentar una llamada a Gemini.

**Cuando se usa:** cuando se necesita pausar la ejecucion, medir tiempos o implementar reintentos con espera entre intentos.

**Ejemplo:**

```python
import time

print("Reintentando en 2 segundos...")
time.sleep(2)
print("Nuevo intento")
```

### `typing`

**Que hace:** proporciona utilidades para anotaciones de tipos. En el laboratorio se usa `Any` cuando el tipo concreto de un objeto externo no esta declarado.

**Cuando se usa:** cuando se quiere documentar mejor la forma esperada de parametros y retornos, o ayudar a editores como Pyright/Pylance.

**Ejemplo:**

```python
from typing import Any


def show_value(value: Any) -> None:
    print(value)
```

### `sys`

**Que hace:** permite interactuar con detalles del interprete de Python. En los laboratorios se usa `sys.path` para ajustar rutas de importacion cuando un script vive en un subdirectorio.

**Cuando se usa:** cuando se necesita ajustar rutas de importacion, leer argumentos de consola o consultar informacion del interprete.

**Ejemplo:**

```python
import sys

sys.path.insert(0, "labs")
```

### `pathlib`

**Que hace:** permite trabajar con rutas de archivos y directorios usando objetos `Path`.

**Cuando se usa:** cuando se necesita construir rutas portables sin concatenar strings manualmente.

**Ejemplo:**

```python
from pathlib import Path

base_dir = Path(__file__).resolve().parents[1]
print(base_dir)
```

### `collections.abc`

**Que hace:** contiene tipos abstractos para colecciones y objetos invocables. Puede usarse para tipar funciones recibidas como parametro.

**Cuando se usa:** cuando una funcion recibe otra funcion como argumento y se quiere documentar su firma esperada.

**Ejemplo:**

```python
from collections.abc import Callable


def run(operation: Callable[[], str]) -> str:
    return operation()
```

## Dependencias Externas

### `python-dotenv`

**Que hace:** carga variables de entorno desde un archivo `.env`. En el laboratorio se usa `load_dotenv()` para que `GEMINI_API_KEY` quede disponible para Python.

**Cuando se usa:** cuando el proyecto necesita configuracion local que no debe escribirse directamente en el codigo, como API keys, URLs o credenciales.

**Ejemplo:**

```python
import os

from dotenv import load_dotenv

load_dotenv(override=True)

api_key = os.getenv("GEMINI_API_KEY")
print(api_key is not None)
```

### `google-genai`

**Que hace:** es el SDK de Google para consumir modelos Gemini desde Python. En el laboratorio se usa para crear un cliente, generar contenido, abrir un chat y manejar errores de la API.

**Cuando se usa:** cuando una aplicacion Python necesita llamar a Gemini para generar texto, mantener conversaciones, procesar prompts o integrar modelos generativos.

**Ejemplo basico con `genai.Client`:**

```python
from google import genai

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents="Explica en una frase que es un agente de IA.",
)

print(response.text)
```

**Ejemplo con chat:**

```python
from google import genai

client = genai.Client()
chat = client.chats.create(model="gemini-2.5-flash-lite")

response = chat.send_message("Hola, responde en una frase.")
print(response.text)
```

### `google.genai.types`

**Que hace:** contiene tipos auxiliares del SDK. En el laboratorio se usan `types.Content`, `types.Part` y `types.GenerateContentResponse` para construir mensajes estructurados y anotar respuestas.

**Cuando se usa:** cuando se necesita representar conversaciones con roles, partes de contenido o respuestas tipadas del SDK.

**Ejemplo:**

```python
from google import genai
from google.genai import types

client = genai.Client()

contents = [
    types.Content(
        role="user",
        parts=[types.Part(text="Mi nombre es Ana")],
    ),
    types.Content(
        role="user",
        parts=[types.Part(text="Como me llamo?")],
    ),
]

response: types.GenerateContentResponse = client.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents=contents,
)
```

### `google.genai.errors`

**Que hace:** contiene errores definidos por el SDK. En el laboratorio se usa `errors.APIError` para capturar fallos de la API y decidir si conviene reintentar.

**Cuando se usa:** cuando se quiere manejar errores de Gemini de forma controlada, por ejemplo limites de cuota, errores temporales del servidor o errores no recuperables.

**Ejemplo:**

```python
from google import genai
from google.genai import errors

client = genai.Client()

try:
    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents="Hola",
    )
    print(response.text)
except errors.APIError as error:
    status_code = getattr(error, "code", None)
    print(f"Error de Gemini: {status_code}")
```

### `openai`

**Que hace:** es el SDK oficial de OpenAI para consumir la API desde Python. En el laboratorio de OpenIA se usa para crear un cliente con `OpenAI()` y llamar a Chat Completions con `client.chat.completions.create()`.

**Cuando se usa:** cuando una aplicacion Python necesita llamar a modelos de OpenAI para generar texto, crear respuestas con contexto o integrar capacidades generativas.

**Ejemplo basico con `OpenAI`:**

```python
from openai import OpenAI

client = OpenAI()

messages = [
    {"role": "user", "content": "Explica en una frase que es un agente de IA."}
]

response = client.chat.completions.create(
    model="gpt-5-nano",
    messages=messages,
)

print(response.choices[0].message.content)
```

### `openai.APIStatusError`

**Que hace:** representa errores HTTP devueltos por la API de OpenAI. En el laboratorio se usa para revisar `status_code` y decidir si un error temporal puede reintentarse.

**Cuando se usa:** cuando se quiere manejar errores de la API de forma controlada, por ejemplo errores `500`, `502`, `503` o `504`.

**Ejemplo:**

```python
from openai import APIStatusError, OpenAI

client = OpenAI()

try:
    response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": "Hola"}],
    )
    print(response.choices[0].message.content)
except APIStatusError as error:
    print(error.status_code)
```

### `ollama`

**Que hace:** es el SDK de Python para usar Ollama de forma local. En el laboratorio se usa para crear un cliente con `Client()` y llamar a `client.chat()` contra modelos descargados en la maquina.

**Cuando se usa:** cuando una aplicacion Python necesita ejecutar modelos locales sin API key, comparar respuestas contra proveedores de nube o trabajar con modelos de programacion como `qwen2.5-coder:3b`.

**Ejemplo basico con `Client`:**

```python
from ollama import Client

client = Client()

messages = [
    {"role": "user", "content": "Explica en una frase que es un agente de IA."}
]

response = client.chat(
    model="gemma3:4b",
    messages=messages,
)

print(response.message.content)
```

## Modulos Internos del Laboratorio

Estos modulos no son librerias externas, pero organizan el ejemplo:

- `config.gemini.config`: carga y valida `GEMINI_API_KEY`, define configuracion de generacion y codigos retryables.
- `config.gemini.gemini_client`: crea el cliente de Gemini.
- `config.gemini.tools`: contiene utilidades especificas de Gemini para retry, preguntas y lectura de `response.text`.
- `config.openia.config`: carga y valida `OPENAI_API_KEY`, y define codigos retryables.
- `config.openia.openai_client`: crea el cliente de OpenAI.
- `config.openia.tools`: contiene utilidades especificas de OpenAI Chat Completions.
- `config.ollama.config`: carga `OLLAMA_HOST`, define modelos recomendados y codigos retryables.
- `config.ollama.ollama_client`: crea el cliente de Ollama.
- `config.ollama.tools`: contiene utilidades especificas de Ollama para retry, preguntas y lectura de `response.message.content`.
- `generate_content_example`: ejecuta una consulta con `client.models.generate_content`.
- `generate_response_example`: ejecuta una consulta con `client.chat.completions.create`.
- `chat_example`: ejecuta una conversacion con `client.chats.create` en Gemini o con una lista `messages` en OpenAI y Ollama.
