# Configuracion de Ollama API

## Proposito

Este documento describe la configuracion minima para usar Ollama desde los laboratorios del proyecto. La idea es tener un proveedor local gratuito que pueda compararse de forma consistente con Gemini y OpenIA/OpenAI usando el mismo tipo de prompts y la misma estructura de salida.

Todos los ejemplos y archivos ejecutables relacionados deben crearse dentro de `labs/`.

## Requisitos

- Windows 10 o Windows 11 de 64 bits.
- Python `>=3.12`, segun `labs/pyproject.toml`.
- `uv`, porque `labs/` ya contiene `uv.lock`.
- Ollama instalado en el equipo.
- El servicio de Ollama en ejecucion local.
- Los modelos que se van a comparar descargados previamente.

## Modelos recomendados para comparacion

Para este equipo se recomiendan estos dos modelos locales:

- `qwen2.5-coder:3b` para tareas de programacion y razonamiento tecnico.
- `gemma3:4b` para consultas generales y mejor comportamiento en espanol.

La comparacion mas util para el curso es mantener ambos modelos instalados y lanzar el mismo prompt contra cada proveedor o cada modelo que se quiera evaluar.

## Instalacion de Ollama

Instalar Ollama desde PowerShell con el instalador oficial:

```powershell
irm https://ollama.com/install.ps1 | iex
```

Tambien se puede instalar desde la pagina oficial:

```txt
https://ollama.com/download/windows
```

La documentacion oficial de Ollama tambien ofrece la biblioteca Python oficial para integracion directa desde scripts.

## Modelos para este laboratorio

Descargar los modelos recomendados:

```powershell
ollama pull qwen2.5-coder:3b
ollama pull gemma3:4b
```

Verificar que estan disponibles:

```powershell
ollama list
```

## Variables de entorno

Ollama no requiere una API key. Para uso local, el cliente Python usa por defecto el servidor local en `http://localhost:11434`.

Si se necesita apuntar a otro host, puede definirse:

```env
OLLAMA_HOST=http://localhost:11434
```

El archivo `labs/.env.template` puede conservar la variable si se desea documentarla:

```env
OLLAMA_HOST=
```

## Ubicacion de modelos

Si ya se sigue la guia del proyecto para mover modelos a `D:`, la variable `OLLAMA_MODELS` debe apuntar a la carpeta elegida antes de descargar nuevos modelos.

Ejemplo:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", "D:\Ollama\models", "User")
```

## Dependencias recomendadas

Para usar Ollama desde Python se recomienda instalar el SDK oficial:

```powershell
cd labs
uv add ollama python-dotenv
```

- `ollama`: biblioteca oficial de Python para la API de Ollama.
- `python-dotenv`: carga las variables definidas en `labs/.env` durante la ejecucion local.

## Ejemplo minimo de consulta

Un [laboratorio inicial](../01-api-config/ollama/main.py) puede usar esta estructura:

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

Ejecucion sugerida:

```powershell
cd labs
uv run python .\01-api-config\ollama\main.py
```

## Estructura usada en el repositorio

La configuracion reutilizable de Ollama vive en:

```txt
labs/config/ollama/
```

Archivos principales:

- `config.py`: carga `OLLAMA_HOST`, define modelos recomendados y codigos HTTP retryables.
- `ollama_client.py`: crea el cliente `Client()`.
- `tools.py`: contiene utilidades especificas de Ollama para enviar mensajes con retry, leer `response.message.content` y ejecutar preguntas.

El laboratorio inicial vive en:

```txt
labs/01-api-config/ollama/
```

Los scripts del laboratorio agregan `labs/` a `sys.path` para poder importar `config.ollama`.

## Comparacion con Gemini y OpenIA/OpenAI

Para comparar tecnologias de forma util:

- Usar el mismo prompt base en los tres proveedores.
- Mantener la misma longitud objetivo de respuesta.
- Comparar texto final normalizado, no solo el tono.
- Probar una pregunta de codigo y una pregunta general.
- Registrar si el modelo responde mejor en ingles o en espanol.

Ollama sirve como referencia local gratuita, mientras que Gemini y OpenIA/OpenAI sirven como referencia de nube. Esa combinacion permite medir costo, latencia, calidad y capacidad de ejecucion local.

## Notas operativas

- Ollama no necesita API key.
- El cliente Python puede apuntar al host local por defecto.
- Si Ollama no esta corriendo, el laboratorio fallara al intentar enviar la primera consulta.
- Los modelos pequenos como `qwen2.5-coder:3b` y `gemma3:4b` son adecuados para el hardware descrito en este proyecto.
- Para comparaciones justas, conviene reutilizar exactamente los mismos prompts entre `labs/config/gemini/`, `labs/config/openia/` y `labs/config/ollama/`.
