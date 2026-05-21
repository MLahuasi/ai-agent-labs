# Persistencia de Contexto de Codex

Este directorio es la raiz oficial para conservar contexto documental entre hilos de Codex en este proyecto. Su objetivo es que cualquier hilo futuro pueda entender el proposito del repositorio, las decisiones vigentes, el estado actual y los cierres historicos sin depender de memoria implicita.

La unica ubicacion valida para persistencia entre hilos es `doc/codex/`. No se deben crear raices alternativas como `codex/`, `docs/codex/` o `src/docs/`.

## Orden de lectura recomendado

1. `README.md`: reglas de uso de esta raiz documental.
2. `project-context.md`: contexto estable del proyecto y arquitectura documental.
3. `decisions.md`: decisiones operativas obligatorias para futuros hilos.
4. `current-state.md`: estado vigente, ultimo cierre registrado, pendientes y siguientes acciones.
5. `threads/`: historial de cierres formales de hilo.

## Regla de continuidad

`current-state.md` debe enlazar obligatoriamente el ultimo hilo generado en `doc/codex/threads/`. Si aun no existe ningun cierre formal, debe declararlo explicitamente y actualizarse en el primer cierre.

Todo cierre documental debe usar `thread-close-template.md` como base y debe actualizar `current-state.md` con el resumen vigente, pendientes no resueltos y siguiente paso recomendado.
