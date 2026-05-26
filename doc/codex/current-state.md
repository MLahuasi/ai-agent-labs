# Estado Vigente

Este archivo almacena el contexto operativo vigente para futuros hilos de Codex. Debe actualizarse durante el cierre formal de cada hilo, despues de crear el archivo correspondiente en `doc/codex/threads/`.

## Ultimo hilo generado

Ultimo hilo generado: [Hilo 004: configurar-apis-ia](./threads/202605261344-configurar-apis-ia.md)

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

Se configuro la base del proyecto para trabajar con Gemini y OpenIA/OpenAI dentro de `labs/`:

- Se consolido `labs/01-gemini-api-config/` con configuracion reutilizable en `labs/config/gemini/`.
- Se creo `labs/01-openia-api-config/` con configuracion reutilizable en `labs/config/openia/`.
- Se eliminaron piezas que agregaban complejidad sin uso real, como `labs/shared/responses.py`, `labs/shared/constants.py`, `labs/01-gemini-api-config/path_bootstrap.py` y `labs/config/path_setup.py`.
- Se actualizo la documentacion de configuracion en `labs/config/gemini-api-config.md` y `labs/config/openia-api-config.md`.
- Se actualizo `fundamentos/install-config-windows.md` para incluir dependencias, variables de entorno, validaciones y menu para ambos proveedores.
- Se actualizaron `doc/library/python-library-reference.md` y `doc/library/python-language-reference.md` para reflejar librerias y patrones realmente usados.
- `labs/01-openia-api-config/main.py` se ejecuto manualmente con resultado esperado.

## Pendientes o bloqueos

- Falta ejecutar manualmente `labs/01-gemini-api-config/main.py` cuando haya cuota disponible en Gemini.
- El unico bloqueo vigente es externo: limite de cuota o tokens del free tier de Gemini.

Agregar futuros laboratorios al menu de `labs/README.md` no queda como pendiente abierto; se realizara en el hilo correspondiente cuando existan nuevos laboratorios.

Los hilos cerrados en `doc/codex/threads/` son inmutables. Las referencias historicas antiguas, por ejemplo a `labs/config/environment-config.md`, no deben editarse en cierres ya generados.

## Siguientes acciones recomendadas

- Usar `doc/codex/current-state.md` como punto de partida del siguiente hilo.
- Ejecutar `labs/01-gemini-api-config/main.py` cuando haya cuota disponible para cerrar la validacion funcional de ambos proveedores.
- A partir de esa base, continuar con nuevos laboratorios sobre Gemini u OpenIA/OpenAI reutilizando `labs/config/gemini/` y `labs/config/openia/`.

## Regla de actualizacion

Este archivo se actualiza cuando el usuario solicita cerrar un hilo y valida la propuesta previa de observaciones, pendientes o bloqueos y siguiente paso recomendado.
