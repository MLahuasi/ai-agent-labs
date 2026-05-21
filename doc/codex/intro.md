Quiero implementar un sistema de persistencia de contexto entre hilos de Codex para que el proyecto mantenga continuidad documental a través del tiempo.

## Objetivo general

Crear una estructura en `doc/codex/` que permita a futuros hilos entender el proyecto, sus decisiones vigentes, el estado actual y el historial de cierres sin depender de memoria implícita.

## Instrucciones de implementación

### 1. Crear la estructura base

Crear el directorio `doc/codex/` y dentro de él los siguientes archivos:

- `README.md`
- `project-context.md`
- `decisions.md`
- `current-state.md`
- `thread-close-template.md`

Crear también el directorio:

- `doc/codex/threads`

### 2. Implementar el contenido de cada archivo con estos objetivos

#### `README.md`

Debe ser el punto raíz de la documentación persistente de Codex.

Debe:

- explicar el objetivo del sistema de persistencia
- indicar el orden de lectura recomendado
- dejar claro que `doc/codex` es la única raíz válida para persistencia entre hilos
- indicar que `current-state.md` debe enlazar obligatoriamente el último hilo generado

#### `project-context.md`

Debe contener:

- propósito del archivo
- naturaleza del proyecto
- objetivo del proyecto
- arquitectura
- enfoque arquitectónico
- capas del sistema y objetivo de cada capa
- aspectos técnicos más relevantes
- dependencias principales
- referencias internas útiles si existen

Este archivo debe completarse usando el contexto real del proyecto, no con texto genérico vacío.

#### `decisions.md`

Debe registrar estándares operativos obligatorios para todos los hilos.

Debe incluir como mínimo estas decisiones:

- la persistencia entre hilos vive únicamente en `doc/codex`
- cuando se solicite `cerrar hilo`, el hilo debe iniciar el proceso formal de cierre
- cuando se solicite `cerrar hilo`, el hilo debe pedir siempre al usuario estos datos antes de crear el archivo:
  - número del hilo
  - tema
  - fecha y hora con formato `YYYYMMDDHHmm`
- el número de hilo es obligatorio
- el nombre del archivo debe seguir el formato `YYYYMMDDHHmm-tema.md`
- el tema puede ser escrito por el usuario en cualquier formato, pero el hilo debe normalizarlo para el nombre del archivo aplicando estas reglas:
  - convertir a minúsculas
  - quitar tildes
  - reemplazar espacios por `-`
  - eliminar estos caracteres: `, . : ; / \ ? ! ¿ * " ' < > |`
  - colapsar múltiples `-` en uno solo
- cuando se solicite `cerrar hilo`, el hilo debe retornar primero al usuario una propuesta de:
  - Observaciones
  - Pendientes o Bloqueos
  - Siguiente Paso Recomendado
- solo después de la validación o feedback explícito del usuario se puede cerrar el hilo creando el archivo
- nunca se debe cerrar un hilo sin autorización explícita del usuario
- cuando se solicite `cerrar hilo`, el hilo debe generar un markdown en `doc/codex/threads`
- todo cierre documental debe usar como base `doc/codex/thread-close-template.md`
- `current-state.md` debe enlazar obligatoriamente el último hilo generado
- todo pendiente no resuelto debe registrarse en `current-state.md` y proponerse para continuidad en el siguiente hilo, salvo que el usuario indique que no es necesario
- al solicitar `cerrar hilo`, el hilo siempre debe informar al usuario qué puntos no se resolvieron y consultar si desea que continúen en el siguiente hilo

#### `current-state.md`

Debe:

- almacenar el contexto vigente
- resumir lo más reciente realizado
- enlazar obligatoriamente el último hilo generado
- registrar pendientes o bloqueos
- registrar siguientes acciones recomendadas
- dejar claro que se actualiza cuando se solicita al hilo cerrar y resumir el proceso
- registrar los pendientes no resueltos que deban proponerse para continuidad en el siguiente hilo, salvo que el usuario indique que no es necesario

#### `thread-close-template.md`

Debe ser la plantilla oficial obligatoria para los cierres de hilo.

Debe contener esta estructura base:

```md
# Hilo [numero]: [Tema]

Fecha: [YYYYMMDDHHmm]

## Objetivo

## Alcance

## Implementaciones Principales (Resumen técnico)

## Archivos o Componentes Afectados

## Decisiones Aplicadas

## Observaciones

## Pendientes o Bloqueos

## Siguiente Paso Recomendado
```

## Reglas importantes del cierre de hilo

- Antes de cerrar el hilo, cuando el usuario escriba `cerrar hilo`, debes retornar una propuesta de:
  - Observaciones
  - Pendientes o Bloqueos
  - Siguiente Paso Recomendado
- El usuario debe validar esa propuesta o darte feedback.
- Solo después de esa validación puedes crear el archivo de cierre.
- Nunca cierres un hilo sin autorización explícita del usuario.
- Antes de crear el archivo debes solicitar obligatoriamente:
  - número del hilo
  - tema
  - fecha y hora con formato `YYYYMMDDHHmm`

### 3. Regla de ubicación

La persistencia de contexto siempre debe guardarse en `doc/codex`.

No se debe crear una raíz alternativa como:

- `codex/`
- `docs/codex/`
- `src/docs/`

La única ubicación válida es:

- `doc/codex/`

### 4. Calidad del contenido

El contenido debe quedar redactado de forma operativa, concreta y reutilizable por futuros hilos.

No dejar placeholders vagos si el repositorio ya permite inferir contexto real.

### 5. Al finalizar la implementación

Debes:

- confirmar qué archivos fueron creados o modificados
- resumir las decisiones operativas aplicadas
- indicar cualquier pendiente que convenga formalizar después

### 6. Reglas de trabajo del hilo

- Si el hilo abarca demasiados temas, debes alertar al usuario que la idea es que un hilo resuelva un tema específico y sugerir dividir el trabajo.
- Antes de implementar cualquier cambio en código o documentación, debes detallar al usuario qué piensas realizar y por qué es necesario.
- No debes realizar cambios sin la autorización explícita del usuario.
- Nunca debes hacer push, crear PR ni subir cambios directamente a GitHub. Esa tarea la realizará el usuario manualmente.
