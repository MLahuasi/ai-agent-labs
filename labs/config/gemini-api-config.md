# Configuracion de Gemini API

## Proposito

Este documento describe la configuracion minima para usar Gemini API desde los laboratorios del proyecto. Todos los ejemplos y archivos ejecutables relacionados deben crearse dentro de `labs/`.

## Requisitos

- Python `>=3.12`, segun `labs/pyproject.toml`.
- `uv`, porque `labs/` ya contiene `uv.lock`.
- Una API key creada en Google AI Studio o en la plataforma correspondiente de Gemini API.
- Archivo local `labs/.env` con la variable de entorno de Gemini.

## Creacion de API key

Para crear la API key desde Google AI Studio:

1. Ingresar a `https://aistudio.google.com/apps`.
2. Seleccionar la opcion `Get API key`.
3. Crear una nueva API key o seleccionar una existente, segun corresponda.
4. Copiar la API key generada.
5. Pegar la API key en el archivo local `labs/.env`.

La API key es un secreto. No debe pegarse en archivos Markdown, codigo fuente, capturas, commits ni mensajes compartidos.

## Variables de entorno

El archivo `labs/.env` debe contener:

```env
GEMINI_API_KEY=tu_api_key
```

No se debe versionar `labs/.env`. El repositorio ya ignora archivos `.env`.

El archivo `labs/.env.template` puede conservar solo el nombre de la variable:

```env
GEMINI_API_KEY=
```

## Dependencias recomendadas

Para usar Gemini API desde Python se recomienda instalar el SDK actual:

```powershell
cd labs
uv add google-genai python-dotenv
```

- `google-genai`: SDK actual de Google para usar Gemini API desde Python.
- `python-dotenv`: carga las variables definidas en `labs/.env` durante la ejecucion local.

No se recomienda usar `google-generativeai` para nuevos laboratorios, porque corresponde al SDK anterior.

## Ejemplo minimo de consulta

Un [laboratorio inicial](../01-gemini-api-config/main.py) puede usar esta estructura simplificada:

```python
from google import genai

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents="Explica en una frase que es un agente de IA.",
)

print(response.text)
```

Ejecucion sugerida:

```powershell
cd labs
uv run python .\01-gemini-api-config\main.py
```

## Estructura usada en el repositorio

La configuracion reutilizable de Gemini vive en:

```txt
labs/config/gemini/
```

Archivos principales:

- `config.py`: carga `GEMINI_API_KEY`, define `GEMINI_GENERATION_CONFIG` y codigos HTTP retryables.
- `gemini_client.py`: crea el cliente `genai.Client()`.
- `tools.py`: contiene utilidades especificas de Gemini para enviar mensajes con retry, leer `response.text` y ejecutar preguntas.

El laboratorio inicial vive en:

```txt
labs/01-gemini-api-config/
```

Los scripts del laboratorio agregan `labs/` a `sys.path` para poder importar `config.gemini`.

## Notas operativas

- No hace falta instalar Google Cloud CLI si se usa Gemini Developer API con `GEMINI_API_KEY`.
- Para uso local, la clave debe permanecer en `labs/.env`.
- Los laboratorios de Gemini deben vivir en `labs/`.
- El laboratorio actual ejecuta por defecto un ejemplo agentic simple para evitar consumir demasiadas llamadas por corrida.
- El laboratorio de Gemini vive en [`01-gemini-api-config/main.py`](../01-gemini-api-config/main.py).
