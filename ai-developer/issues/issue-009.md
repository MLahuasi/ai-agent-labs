
# Issue #9: Vector Store Fails Silently with Invalid DB_PATH
## Metadata
- **Fecha:** 2026-08-21
- **Prioridad:** high
- **Etiquetas:** bug, rag
- **Estado:** abierto
## Descripción
El vector store falla silenciosamente cuando DB_PATH apunta a un directorio que no existe. En vez de crear la base de datos en una ubicación inesperada, debería lanzar un error claro que indique el problema con la ruta especificada.
---
*Issue creado automáticamente por Robotitus*
