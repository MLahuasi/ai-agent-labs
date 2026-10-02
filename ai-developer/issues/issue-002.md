
# Issue #2: El vector store falla silenciosamente con DB_PATH no existente
## Metadata
- **Fecha:** 2026-08-15
- **Prioridad:** high
- **Etiquetas:** bug, rag
- **Estado:** abierto
## Descripción
Cuando DB_PATH apunta a un directorio que no existe, el vector store falla silenciosamente y crea la base de datos en una ubicación inesperada. Se debería lanzar un error claro en lugar de esta funcionalidad. Es necesario corregir este comportamiento para mejorar la claridad en el manejo de errores.
---
*Issue creado automáticamente por Robotitus*
