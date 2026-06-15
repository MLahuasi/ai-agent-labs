# Estado Vigente

Este archivo almacena el contexto operativo vigente para futuros hilos de Codex. Debe actualizarse durante el cierre formal de cada hilo, despues de crear el archivo correspondiente en `doc/codex/threads/`.

## Ultimo hilo generado

Ultimo hilo generado: [Hilo 005: comparar-llms-agentes-de-ia-recursos](./threads/202606151255-comparar-llms-agentes-de-ia-recursos.md)

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

Se extendio la base de laboratorios para comparar proveedores y documentar recursos agénticos dentro de `labs/`:

- Se homologaron clientes reutilizables para Gemini, OpenIA/OpenAI, Ollama y Groq dentro de `labs/config/`.
- Se corrigieron problemas de importacion, compatibilidad de historial y rutas de archivos en laboratorios como `01-api-config`, `02-multiple-orchestration` y `03-recursos-agentes-ia`.
- Se documento el uso de recursos en agentes usando `PDF`, `TXT` y `JSON` como contexto en `fundamentos/ia-agentes-recursos.md`.
- Se actualizaron `doc/library/python-library-reference.md` y `doc/library/python-language-reference.md` para reflejar librerias, patrones y semantica realmente usados, incluyendo `json`, `gradio`, `pypdf`, `with`, `try/finally`, `Path` y generadores.
- Se ajusto Groq para funcionar con la compatibilidad OpenAI usando `base_url="https://api.groq.com/openai/v1"` y el historial compartido con rol `assistant`.

## Pendientes o bloqueos

- No se ejecuto validacion funcional completa de `labs/03-recursos-agentes-ia/main.py` despues de los cambios documentales y de rutas.
- Falta ejecutar manualmente `labs/01-api-config/gemini/main.py` cuando haya cuota disponible en Gemini.
- Queda razonable revisar `doc/library/README.md` para reflejar explicitamente que la referencia ya cubre `gradio` y `pypdf`.
- El unico bloqueo externo vigente es el limite de cuota o tokens del free tier de Gemini.

Agregar futuros laboratorios al menu de `labs/README.md` no queda como pendiente abierto; se realizara en el hilo correspondiente cuando existan nuevos laboratorios.

Los hilos cerrados en `doc/codex/threads/` son inmutables. Las referencias historicas antiguas, por ejemplo a `labs/config/environment-config.md`, no deben editarse en cierres ya generados.

## Siguientes acciones recomendadas

- Usar `doc/codex/current-state.md` como punto de partida del siguiente hilo.
- Ejecutar `labs/03-recursos-agentes-ia/main.py` para validar el laboratorio de recursos de extremo a extremo.
- Actualizar `doc/library/README.md` si se quiere cerrar tambien la referencia de librerias a nivel de indice.
- Ejecutar `labs/01-api-config/gemini/main.py` cuando haya cuota disponible para cerrar la validacion funcional pendiente del proveedor.

## Regla de actualizacion

Este archivo se actualiza cuando el usuario solicita cerrar un hilo y valida la propuesta previa de observaciones, pendientes o bloqueos y siguiente paso recomendado.
