# Hilo 005: Comparar LLMs, Agentes de IA, Recursos

Fecha: 202606151255

## Objetivo

Extender y ordenar la base de laboratorios para comparar proveedores y patrones de IA agentica, homologando clientes de LLM, corrigiendo problemas de ejecucion y dejando documentado el uso de recursos en agentes.

## Alcance

- Ajustar y homologar configuraciones reutilizables para OpenIA/OpenAI, Gemini, Ollama y Groq dentro de `labs/config/`.
- Corregir problemas de importacion, rutas y estructura comun en laboratorios de `01-api-config`, `02-multiple-orchestration` y `03-recursos-agentes-ia`.
- Refinar el manejo de historial compartido entre proveedores.
- Actualizar documentacion tecnica y de referencia Python para reflejar el estado real del codigo.
- Documentar la diferencia practica entre recursos y herramientas usando el laboratorio `03-recursos-agentes-ia`.

## Implementaciones Principales (Resumen tecnico)

Se corrigieron varios problemas estructurales en los laboratorios Python, especialmente relacionados con `sys.path`, reutilizacion de clientes por proveedor y compatibilidad del historial tipado compartido mediante `ChatMessage`.

Se consolido el soporte de Ollama como proveedor local reutilizable, incluyendo documentacion de configuracion, clientes homologados y ejemplos comparables con Gemini y OpenIA/OpenAI.

Se incorporo Groq usando el cliente `OpenAI` con `base_url="https://api.groq.com/openai/v1"`, manteniendo la estructura comun del cliente y corrigiendo el mapeo de roles del historial para aceptar `assistant`.

Tambien se refactorizaron puntos del laboratorio de orquestacion multiple y del laboratorio de recursos, aclarando el uso de recursos documentales (`PDF`, `TXT`, `JSON`) como contexto del agente, y se actualizaron referencias Python para reflejar librerias y construcciones realmente usadas.

## Archivos o Componentes Afectados

- `labs/01-api-config/gemini/`
- `labs/01-api-config/openia/`
- `labs/01-api-config/ollama/`
- `labs/02-multiple-orchestration/main.py`
- `labs/03-recursos-agentes-ia/main.py`
- `labs/config/gemini/`
- `labs/config/openia/`
- `labs/config/ollama/`
- `labs/config/groq/`
- `labs/config/shared/types.py`
- `labs/config/gemini-api-config.md`
- `labs/config/openia-api-config.md`
- `labs/config/ollama-api-config.md`
- `fundamentos/create-ia-agent.md`
- `fundamentos/install-config-windows.md`
- `fundamentos/ia-agentes-recursos.md`
- `doc/library/python-library-reference.md`
- `doc/library/python-language-reference.md`

## Decisiones Aplicadas

- La persistencia entre hilos se mantiene unicamente en `doc/codex/`.
- La configuracion reutilizable por proveedor vive en `labs/config/<proveedor>/`.
- El historial compartido entre laboratorios se normaliza con `ChatMessage` y roles compatibles entre proveedores.
- Groq se integra mediante compatibilidad OpenAI, sin introducir una estructura distinta de cliente.
- La documentacion debe seguir el codigo real del repositorio y eliminar referencias a componentes obsoletos o eliminados.
- El laboratorio de recursos se documenta como un caso de aumento de contexto, no de uso de herramientas.

## Observaciones

- Se explico y corrigio el problema de rutas relativas en `labs/03-recursos-agentes-ia/main.py`, dejando el acceso a `data/` basado en `Path(__file__)`.
- Se actualizo la documentacion de referencia Python con `json`, `gradio`, `pypdf`, `with`, `try/finally`, `Path` y expresiones generadoras.
- Se limpiaron referencias documentales a archivos eliminados y a modulos `tools.py` que ya no representan la estructura vigente.

## Pendientes o Bloqueos

- No se ejecuto validacion funcional completa de `labs/03-recursos-agentes-ia/main.py` despues de los cambios documentales y de rutas.
- Sigue vigente la ejecucion manual pendiente de `labs/01-api-config/gemini/main.py` cuando haya cuota disponible en Gemini.
- Queda razonable revisar `doc/library/README.md` para reflejar explicitamente que la referencia ya cubre `gradio` y `pypdf`.
- El bloqueo externo vigente sigue siendo la cuota o limite del free tier de Gemini.

## Siguiente Paso Recomendado

Ejecutar `labs/03-recursos-agentes-ia/main.py` para validar el laboratorio de recursos de extremo a extremo. Despues de eso, cerrar la actualizacion documental menor de `doc/library/README.md` y retomar la validacion funcional pendiente de Gemini cuando haya cuota disponible.
