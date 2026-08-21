
# Issue #8: Fallo silencioso en el vector store con DB_PATH inválido
## Metadata
- **Fecha:** 2026-08-21
- **Prioridad:** high
- **Etiquetas:** bug, rag
- **Estado:** abierto
## Descripción
El vector store falla silenciosamente cuando DB_PATH apunta a un directorio que no existe. En este caso, debería lanzar un error claro en lugar de crear la base de datos en una ubicación inesperada.
---
*Issue creado automáticamente por Robotitus*
