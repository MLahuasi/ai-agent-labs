# Configuracion de OpenIA API

## Proposito

Este documento describe la configuracion minima para usar OpenAI API desde los laboratorios del proyecto. Todos los ejemplos y archivos ejecutables relacionados deben crearse dentro de `labs/`.

> Nota: en las rutas del curso se usa `OpenIA` por consistencia con el nombre solicitado para el laboratorio. El SDK, la plataforma y la variable de entorno oficiales usan `OpenAI`.

## Requisitos

- Python `>=3.12`, segun `labs/pyproject.toml`.
- `uv`, porque `labs/` ya contiene `uv.lock`.
- Una API key creada en la plataforma de OpenAI.
- Archivo local `labs/.env` con la variable de entorno de OpenAI.

## Creacion de API key

Para crear la API key desde OpenAI:

1. Ingresar a `https://platform.openai.com/api-keys`.
2. Crear una nueva API key.
3. Copiar la API key generada.
4. Pegar la API key en el archivo local `labs/.env`.

La API key es un secreto. No debe pegarse en archivos Markdown, codigo fuente, capturas, commits ni mensajes compartidos.

## Variables de entorno

El archivo `labs/.env` debe contener:

```env
OPENAI_API_KEY=tu_api_key
```

No se debe versionar `labs/.env`. El repositorio ya ignora archivos `.env`.

El archivo `labs/.env.template` puede conservar solo el nombre de la variable:

```env
OPENAI_API_KEY=
```

## Dependencias recomendadas

Para usar OpenAI API desde Python se recomienda instalar el SDK oficial:

```powershell
cd labs
uv add openai python-dotenv
```

- `openai`: SDK oficial de OpenAI para usar la API desde Python.
- `python-dotenv`: carga las variables definidas en `labs/.env` durante la ejecucion local.

Si `uv` muestra el warning de hardlinks en Windows, el entorno queda funcional. Para ocultarlo puedes usar:

```powershell
uv add openai --link-mode=copy
```

## Modelo recomendado para ahorrar tokens

Para este laboratorio se usa:

```txt
gpt-5-nano
```

Este laboratorio usa Chat Completions y conserva el patron conversacional del notebook base del curso, pero configura `gpt-5-nano` para reducir costo por llamada en los ejemplos actuales.

Si necesitas replicar el notebook original de forma estricta, puedes cambiar temporalmente el modelo a `gpt-4o-mini` en `labs/01-api-config/openia/main.py`.

Referencias:

- `https://github.com/joanby/agents/blob/main/1_foundations/1_lab1.ipynb`
- `https://platform.openai.com/docs/pricing`

## Ejemplo minimo de consulta

Un [laboratorio inicial](../01-api-config/openia/main.py) puede usar esta estructura:

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

Ejecucion sugerida:

```powershell
cd labs
uv run python .\01-api-config\openia\main.py
```

## Notas operativas

- Para uso local, la clave debe permanecer en `labs/.env`.
- El SDK lee `OPENAI_API_KEY` desde las variables de entorno.
- El laboratorio usa `messages` para conservar contexto conversacional.
- La respuesta se lee desde `response.choices[0].message.content`.
- La configuracion reutilizable de OpenIA/OpenAI vive en `labs/config/openia/`.
- `labs/config/openia/config.py` carga `OPENAI_API_KEY` y define codigos HTTP retryables.
- `labs/config/openia/openai_client.py` crea el cliente `OpenAI()`.
- `labs/config/openia/tools.py` contiene utilidades especificas de Chat Completions.
- Los scripts del laboratorio agregan `labs/` a `sys.path` para poder importar `config.openia`.
- El laboratorio de OpenIA vive en [`01-api-config/openia/main.py`](../01-api-config/openia/main.py).
