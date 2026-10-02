
# Issue #3: Vector store falla silenciosamente cuando DB_PATH apunta a un directorio inexistente
## Metadata
- **Fecha:** 2026-08-15
- **Prioridad:** high
- **Etiquetas:** bug, rag
- **Estado:** abierto
## Descripción
## Descripción

El vector store no valida si el directorio especificado en `DB_PATH` existe antes de intentar crear la base de datos. Cuando la ruta apunta a un directorio inexistente, falla silenciosamente y crea la base de datos en una ubicación inesperada, en lugar de lanzar un error claro al desarrollador.

## Comportamiento actual

- Si `DB_PATH` apunta a un directorio que no existe, el vector store no lanza ningún error.
- La base de datos se crea en una ubicación inesperada sin advertencia alguna.
- El desarrollador no recibe retroalimentación sobre el problema de configuración.

## Comportamiento esperado

- Al inicializar el vector store, se debe validar que el directorio especificado en `DB_PATH` exista.
- Si el directorio no existe, se debe lanzar un error descriptivo (ej: `Error: DB_PATH directory does not exist: /ruta/inexistente`) que indique claramente la causa del problema y cómo resolverlo.

## Pasos para reproducir

1. Configurar `DB_PATH` con una ruta cuyo directorio padre no exista (ej: `/ruta/que/no/existe/db`).
2. Inicializar el vector store.
3. Observar que no se lanza ningún error y la base de datos se crea en una ubicación inesperada.

## Impacto

- Dificulta el diagnóstico de errores de configuración.
- Puede generar bases de datos huérfanas en ubicaciones no controladas.
- Riesgo de pérdida de datos si el desarrollador asume que la base de datos se está usando correctamente.

## Solución sugerida

Agregar una validación al momento de inicializar el vector store que verifique la existencia del directorio de `DB_PATH` y lance una excepción con un mensaje claro si no existe.
---
*Issue creado automáticamente por Robotitus*
