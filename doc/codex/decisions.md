# Decisiones Operativas de Codex

Este archivo registra estandares obligatorios para todos los hilos de Codex que trabajen en este repositorio.

## Persistencia documental

- La persistencia entre hilos vive unicamente en `doc/codex/`.
- No se deben crear raices alternativas como `codex/`, `docs/codex/` o `src/docs/`.
- `doc/codex/current-state.md` debe enlazar obligatoriamente el ultimo hilo generado en `doc/codex/threads/`.
- Todo pendiente no resuelto debe registrarse en `current-state.md` y proponerse para continuidad en el siguiente hilo, salvo que el usuario indique que no es necesario.

## Cierre formal de hilo

Cuando el usuario solicite `cerrar hilo`, el hilo debe iniciar el proceso formal de cierre.

Antes de crear cualquier archivo de cierre, el hilo debe pedir siempre al usuario estos datos:

- Numero del hilo.
- Tema.
- Fecha y hora con formato `YYYYMMDDHHmm`.

El numero de hilo es obligatorio.

El nombre del archivo de cierre debe seguir el formato:

```text
YYYYMMDDHHmm-tema.md
```

El tema puede ser escrito por el usuario en cualquier formato, pero el hilo debe normalizarlo para el nombre del archivo aplicando estas reglas:

- Convertir a minusculas.
- Quitar tildes.
- Reemplazar espacios por `-`.
- Eliminar estos caracteres: `, . : ; / \ ? ! ¿ * " ' < > |`.
- Colapsar multiples `-` en uno solo.

## Validacion previa obligatoria

Cuando se solicite `cerrar hilo`, el hilo debe retornar primero al usuario una propuesta de:

- Observaciones.
- Pendientes o Bloqueos.
- Siguiente Paso Recomendado.

Solo despues de la validacion o feedback explicito del usuario se puede cerrar el hilo creando el archivo.

Nunca se debe cerrar un hilo sin autorizacion explicita del usuario.

## Archivo de cierre

Cuando se solicite `cerrar hilo`, el hilo debe generar un Markdown en `doc/codex/threads/`.

Todo cierre documental debe usar como base `doc/codex/thread-close-template.md`.

Los hilos cerrados son inmutables. Nunca se deben editar archivos ya generados en `doc/codex/threads/`, aunque contengan referencias historicas, decisiones antiguas o informacion que haya cambiado despues. Cualquier correccion, aclaracion o cambio de estado posterior debe registrarse en un nuevo cierre de hilo o en `doc/codex/current-state.md`, segun corresponda.

Al solicitar `cerrar hilo`, el hilo siempre debe informar al usuario que puntos no se resolvieron y consultar si desea que continuen en el siguiente hilo.

Despues de crear el cierre, el hilo debe actualizar `current-state.md` para:

- Enlazar el ultimo hilo generado.
- Resumir lo mas reciente realizado.
- Registrar pendientes o bloqueos vigentes.
- Registrar siguientes acciones recomendadas.
