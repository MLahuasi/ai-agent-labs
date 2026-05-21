# Estado Vigente

Este archivo almacena el contexto operativo vigente para futuros hilos de Codex. Debe actualizarse durante el cierre formal de cada hilo, despues de crear el archivo correspondiente en `doc/codex/threads/`.

## Ultimo hilo generado

Ultimo hilo generado: [Hilo 002: environment y gemini config](./threads/202605211652-environment-y-gemini-config.md)

## Contexto vigente

El repositorio `ai-agent-labs` funciona como base documental y practica para una ruta de aprendizaje de ingenieria de agentes de IA. La navegacion principal parte de `README.md` y distribuye el contenido en modulos por tema o framework:

- `fundamentos/`
- `openai-agent-sdk/`
- `crew-ai/`
- `langgraph/`
- `autogen/`
- `mcp/`
- `labs/`

La persistencia entre hilos queda centralizada exclusivamente en `doc/codex/`.

## Mas reciente realizado

Se configuro y valido el primer laboratorio de Gemini API dentro de `labs/`:

- Se documento la configuracion de Gemini API en `labs/config/gemini-api-config.md`.
- Se documento la configuracion del entorno Python en `labs/config/environment-config.md`.
- Se establecio `GEMINI_API_KEY` como variable de entorno estandar.
- Se configuro VS Code mediante `.vscode/settings.json`.
- Se configuro Pylance/Pyright mediante `pyrightconfig.json`.
- Se recreo `labs/.venv` con Python `3.12.11`.
- Se validaron las dependencias `google-genai` y `python-dotenv`.
- Se ejecuto correctamente `labs/01-gemini-api-config/main.py` contra Gemini API.
- Se documento el ejemplo en `labs/01-gemini-api-config/`.

## Pendientes o bloqueos

- Algunos README de modulos existen como archivos vacios o destinos de enlace y conviene completarlos conforme avance el contenido del curso.
- Conviene revisar el contenido final de `labs/01-gemini-api-config/` y enlazarlo desde `labs/README.md` si se decide mantener una ruta ordenada de laboratorios.

Todo pendiente no resuelto debe proponerse para continuidad en el siguiente hilo, salvo que el usuario indique que no es necesario.

## Siguientes acciones recomendadas

- Usar `doc/codex/current-state.md` como punto de partida del siguiente hilo.
- Formalizar `labs/01-gemini-api-config/` como primer laboratorio estable y enlazarlo desde `labs/README.md`.
- Continuar con un siguiente laboratorio practico usando Gemini, por ejemplo una consulta parametrizada, manejo de errores o comparacion de modelos.

## Regla de actualizacion

Este archivo se actualiza cuando el usuario solicita cerrar un hilo y valida la propuesta previa de observaciones, pendientes o bloqueos y siguiente paso recomendado.
