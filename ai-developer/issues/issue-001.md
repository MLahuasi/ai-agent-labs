# Issue #1: El vector store falla silenciosamente con DB_PATH no válido

## Metadata

- **Fecha:** 2026-08-15
- **Prioridad:** high
- **Etiquetas:** bug, rag
- **Estado:** abierto

## Descripción

## Cuando DB_PATH apunta a un directorio que no existe, el vector store falla silenciosamente. En lugar de crear la base de datos en una ubicación inesperada, debería lanzar un error claro para indicar que la ruta especificada no es válida.

_Issue creado automáticamente por Robotitus_
