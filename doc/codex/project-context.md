# Contexto del Proyecto

## Proposito del archivo

Este archivo conserva el contexto estable del repositorio para que futuros hilos de Codex puedan trabajar con continuidad. Debe describir que es el proyecto, como esta organizado y cuales son sus referencias internas principales.

## Naturaleza del proyecto

`ai-agent-labs` es un repositorio educativo y practico sobre ingenieria de agentes de IA. El contenido esta organizado como una ruta de aprendizaje por temas y frameworks, con documentacion en Markdown y un espacio inicial para laboratorios ejecutables en Python.

El repositorio combina:

- Material introductorio sobre fundamentos de agentes.
- Modulos por tecnologias agénticas: OpenAI Agent SDK, CrewAI, LangGraph, AutoGen y MCP.
- Un workspace `labs/` para experimentos o ejercicios de codigo.
- Documentacion auxiliar para configuracion de entorno, especialmente en Windows.

## Objetivo del proyecto

El objetivo es servir como base de estudio y practica para construir, comparar y evolucionar soluciones con agentes de IA. La estructura busca separar los fundamentos, los frameworks y los proyectos practicos para que el aprendizaje pueda avanzar por capas.

## Arquitectura

La arquitectura actual es principalmente documental, con un area de laboratorios Python:

- `README.md`: indice principal de la ruta de aprendizaje.
- `fundamentos/`: conceptos base, configuracion de ambiente y primer proyecto.
- `openai-agent-sdk/`: contenidos y proyectos relacionados con el SDK de agentes de OpenAI.
- `crew-ai/`: contenidos y proyectos sobre CrewAI.
- `langgraph/`: contenidos y proyectos sobre LangGraph.
- `autogen/`: contenidos y proyectos sobre AutoGen.
- `mcp/`: contenidos y proyectos sobre Model Context Protocol.
- `labs/`: proyecto Python inicial con `pyproject.toml`, `uv.lock` y `main.py`.
- `assets/`: recursos visuales usados por la documentacion, como banners.
- `doc/codex/`: persistencia documental entre hilos de Codex.

## Enfoque arquitectonico

El enfoque del repositorio es modular por tema. Cada directorio de tecnologia funciona como una unidad de aprendizaje independiente enlazada desde el README principal. La continuidad entre hilos de trabajo no debe mezclarse con los modulos de aprendizaje; vive exclusivamente en `doc/codex/`.

El codigo ejecutable debe concentrarse en `labs/` o en futuros subproyectos claramente delimitados. La documentacion conceptual debe mantenerse cerca del modulo correspondiente, salvo la documentacion de persistencia de Codex, que tiene raiz unica.

## Capas del sistema

- Capa de indice: `README.md` organiza la navegacion general del curso.
- Capa de fundamentos: `fundamentos/` contiene conceptos base y configuracion inicial.
- Capa de frameworks: `openai-agent-sdk/`, `crew-ai/`, `langgraph/`, `autogen/` y `mcp/` agrupan contenidos por tecnologia.
- Capa de laboratorios: `labs/` contiene el proyecto Python para pruebas practicas.
- Capa de recursos: `assets/` contiene imagenes y otros materiales visuales.
- Capa de continuidad Codex: `doc/codex/` conserva decisiones, estado vigente y cierres de hilo.

## Aspectos tecnicos relevantes

- El repositorio usa Markdown como formato principal de documentacion.
- `labs/` esta definido como proyecto Python con `pyproject.toml`.
- La version de Python declarada en `labs/pyproject.toml` es `>=3.12`.
- `labs/uv.lock` indica uso de `uv` como gestor o herramienta de entorno para el laboratorio.
- Actualmente `labs/main.py` contiene una funcion `main()` minima que imprime un mensaje inicial.
- Los README de algunos modulos todavia estan vacios o sirven como destino de enlaces desde el indice principal.

## Dependencias principales

- Python `>=3.12` para el workspace `labs/`.
- `uv` como herramienta asociada al lockfile de `labs/`.
- Markdown para la documentacion.

No hay dependencias Python declaradas actualmente en `labs/pyproject.toml`.

## Referencias internas utiles

- `README.md`: indice general del proyecto.
- `fundamentos/install-config-windows.md`: configuracion de ambiente Windows.
- `fundamentos/README.md`: modulo de fundamentos.
- `labs/pyproject.toml`: configuracion del laboratorio Python.
- `labs/main.py`: punto de entrada actual del laboratorio.
- `doc/codex/decisions.md`: reglas obligatorias para hilos futuros.
- `doc/codex/current-state.md`: estado vigente para continuidad.
