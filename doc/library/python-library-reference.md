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

**Que hace:** ofrece funciones relacionadas con tiempo. En los clientes del laboratorio se usa `time.sleep()` para esperar antes de reintentar una llamada a un proveedor.

**Cuando se usa:** cuando se necesita pausar la ejecucion, medir tiempos o implementar reintentos con espera entre intentos.

**Ejemplo:**

```python
import time

print("Reintentando en 2 segundos...")
time.sleep(2)
print("Nuevo intento")
```

### `typing`

**Que hace:** proporciona utilidades para anotaciones de tipos. En el laboratorio se usa para declarar listas tipadas, tipos de retorno y contratos mas estrictos para clientes y respuestas.

**Cuando se usa:** cuando se quiere documentar mejor la forma esperada de parametros y retornos, o ayudar a editores como Pyright/Pylance.

**Ejemplo:**

```python
from typing import Any


def chat(message: str, history: list[dict[str, Any]]) -> str:
    return message
```

En [main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py), `Any` se usa para tipar la estructura que Gradio entrega al callback.

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

base_dir = Path(__file__).resolve().parent
data_dir = base_dir / "data"
```

En [labs/03-recursos-agentes-ia/main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py), `Path` se usa para resolver `data/` e `history.json` sin depender del directorio actual desde donde se ejecuta el script.

### `json`

**Que hace:** permite convertir entre estructuras Python y texto JSON. En el laboratorio se usa para persistir y recuperar el historial de conversación.

**Cuando se usa:** cuando se necesita guardar listas o diccionarios en disco, intercambiar datos entre procesos o rehidratar estado en una nueva ejecucion.

**Ejemplo:**

```python
import json

history = [{"role": "user", "content": "Hola"}]

with open("history.json", "w", encoding="utf-8") as file:
    json.dump(history, file, indent=4, ensure_ascii=False)

with open("history.json", "r", encoding="utf-8") as file:
    restored = json.load(file)
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

**Que hace:** carga variables de entorno desde un archivo `.env`.

**Cuando se usa:** cuando el proyecto necesita configuracion local que no debe escribirse directamente en el codigo, como API keys, URLs o credenciales.

**Ejemplo:**

```python
import os

from dotenv import load_dotenv

load_dotenv(override=True)

api_key = os.getenv("OPENAI_API_KEY")
print(api_key is not None)
```

### `google-genai`

**Que hace:** es el SDK de Google para consumir modelos Gemini desde Python. En el proyecto se usa para crear un cliente, abrir un chat y generar respuestas con historial.

**Cuando se usa:** cuando una aplicacion Python necesita llamar a Gemini para generar texto, mantener conversaciones o integrar modelos generativos.

**Ejemplo basico con `genai.Client`:**

```python
from google import genai

client = genai.Client()
chat = client.chats.create(model="gemini-2.5-flash-lite")

response = chat.send_message("Explica en una frase que es un agente de IA.")
print(response.text)
```

### `google.genai.types`

**Que hace:** contiene tipos auxiliares del SDK. Puede usarse para representar mensajes, configuraciones y respuestas tipadas de Gemini.

**Cuando se usa:** cuando se necesita representar conversaciones con roles, partes de contenido o respuestas tipadas del SDK.

**Ejemplo:**

```python
from google.genai import types

message = types.Part(text="Hola")
print(message.text)
```

### `google.genai.errors`

**Que hace:** contiene errores definidos por el SDK. En el proyecto se usa para capturar fallos de la API y decidir si conviene reintentar.

**Cuando se usa:** cuando se quiere manejar errores de Gemini de forma controlada, por ejemplo limites de cuota o errores temporales del servidor.

**Ejemplo:**

```python
from google.genai import errors

try:
    ...
except errors.APIError as error:
    status_code = getattr(error, "code", None)
    print(status_code)
```

### `openai`

**Que hace:** es el SDK oficial de OpenAI para consumir la API desde Python. En el proyecto tambien se reutiliza su cliente `OpenAI` para Groq mediante `base_url`.

**Cuando se usa:** cuando una aplicacion Python necesita llamar a modelos compatibles con la API de OpenAI para generar texto o mantener conversaciones.

**Ejemplo basico con `OpenAI`:**

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-5-nano",
    messages=[{"role": "user", "content": "Hola"}],
)

print(response.choices[0].message.content)
```

### `openai.APIStatusError`

**Que hace:** representa errores HTTP devueltos por APIs compatibles con OpenAI. En el proyecto se usa para revisar `status_code` y decidir si un error temporal puede reintentarse.

**Cuando se usa:** cuando se quiere manejar errores `500`, `502`, `503` o `504`.

**Ejemplo:**

```python
from openai import APIStatusError, OpenAI

client = OpenAI()

try:
    ...
except APIStatusError as error:
    print(error.status_code)
```

### `ollama`

**Que hace:** es el SDK de Python para usar Ollama de forma local. En el proyecto se usa para crear un cliente con `Client()` y llamar a `client.chat()` contra modelos descargados en la maquina.

**Cuando se usa:** cuando una aplicacion Python necesita ejecutar modelos locales sin API key, comparar respuestas contra proveedores de nube o trabajar con modelos instalados en el equipo.

**Ejemplo basico con `Client`:**

```python
from ollama import Client

client = Client()

response = client.chat(
    model="gemma3:4b",
    messages=[{"role": "user", "content": "Hola"}],
)

print(response.message.content)
```

### `gradio`

**Que hace:** permite crear interfaces web rapidas en Python para conversar, cargar datos o exponer demos locales. En el laboratorio se usa `gr.ChatInterface` para abrir una UI de chat.

**Cuando se usa:** cuando se quiere probar un agente o flujo conversacional sin construir manualmente una aplicacion web completa.

**Ejemplo basico con `ChatInterface`:**

```python
import gradio as gr

def chat(message: str, history: list[dict[str, str]]) -> str:
    return f"Recibido: {message}"

gr.ChatInterface(fn=chat).launch()
```

### `pypdf`

**Que hace:** permite leer archivos PDF desde Python. En el laboratorio se usa `PdfReader` para extraer texto de un CV y convertirlo en contexto para el agente.

**Cuando se usa:** cuando un agente necesita consumir documentos locales como PDFs antes de construir el prompt o un contexto recuperable.

**Ejemplo basico con `PdfReader`:**

```python
from pypdf import PdfReader

reader = PdfReader("documento.pdf")

text = ""
for page in reader.pages:
    content = page.extract_text()
    if content:
        text += content
```

### `pyright`

**Que hace:** es el verificador estatico de tipos usado para detectar errores de imports, firmas incompatibles y usos incorrectos de tipos en los laboratorios Python.

**Ejemplo de ejecucion desde `labs/`:**

```powershell
uv run pyright .
```

**Configuracion actual del proyecto:**

```json
{
  "include": ["."],
  "venvPath": ".",
  "venv": ".venv",
  "typeCheckingMode": "strict"
}
```

En este repositorio esa configuracion vive en [labs/pyrightconfig.json](/D:/Fuentes/Core/ai-agent-labs/labs/pyrightconfig.json).

## Modulos Internos del Laboratorio

Estos modulos no son librerias externas, pero organizan el ejemplo:

- `config.gemini.config`: carga y valida `GEMINI_API_KEY`, define configuracion de generacion y codigos retryables.
- `config.gemini.gemini_client`: crea el cliente de Gemini, construye historial, aplica reintentos y expone `ask_chat_question`.
- `config.openia.config`: carga y valida `OPENAI_API_KEY`, y define codigos retryables.
- `config.openia.openai_client`: crea el cliente de OpenAI, construye historial, aplica reintentos y expone `ask_chat_question`.
- `config.ollama.config`: carga `OLLAMA_HOST`, define modelos recomendados y codigos retryables.
- `config.ollama.ollama_client`: crea el cliente de Ollama, construye historial, aplica reintentos y expone `ask_chat_question`.
- `config.groq.config`: carga y valida `GROQ_API_KEY`, define `GROQ_BASE_URL` y codigos retryables.
- `config.groq.groq_client`: crea el cliente compatible con la API estilo OpenAI para Groq y expone `ask_chat_question`.
- `config.shared.types`: define `ChatMessage`, el tipo base compartido para historial entre laboratorios.
