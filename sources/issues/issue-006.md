
# Issue #6: Vector Store crea BD en ubicación inesperada cuando DB_PATH es inexistente
## Metadata
- **Fecha:** 2026-08-15
- **Prioridad:** high
- **Etiquetas:** bug, rag
- **Estado:** abierto
## Descripción
El vector store falla silenciosamente cuando DB_PATH apunta a un directorio que no existe. En lugar de lanzar un error claro, el sistema crea la base de datos en una ubicación inesperada, lo que puede llevar a datos perdidos o errores de ruta. Este comportamiento dificulta el diagnóstico y la depuración. Se debe validar la existencia del directorio antes de crear o abrir la base de datos y lanzar una excepción informativa si el directorio no está presente.
---
*Issue creado automáticamente por Robotitus*
