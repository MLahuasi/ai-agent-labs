# Laboratorios

Este directorio contiene los laboratorios practicos del proyecto `ai-agent-labs`.

## Menu

| #   | Laboratorio                                                                               | Objetivo                                                                                              |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 01  | [Configuración `clientes` para ejecutar LLMs (OpenIA, Gemini Ollama)](./config/README.md) | Configuración LLMs                                                                                    |
| 02  | [Creación de un Agente Básico](./01-api-config/README.md)                                 | Validar la configuracion inicial de OpenAI API desde Python usando `clientes` y variables de entorno. |
| 03  | [Comparación entre LLMs](./02-comparacion-llms/main.py)                                   | Comparación entre varios LLMs usando Python mediante `clientes` y variables de entorno.               |
|     |                                                                                           | Orquestación de LLMs para obtener un ranking segúlas respuestas de cada uno                           |

## Ejecucion general

Desde el directorio del laboratorio:

```powershell
uv run python main.py
```

## Apuntes

- [`Top LLMs y Comparaciones`](https://www.vellum.ai/llm-leaderboard)
