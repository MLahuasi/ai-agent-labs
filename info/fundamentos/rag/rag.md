# 🔎 RAG

## 🧠 Cómo funciona un sistema RAG (Retrieval-Augmented Generation)

Un sistema **RAG (Generación aumentada mediante recuperación de información)** combina las capacidades de búsqueda de información con la potencia de generación de texto de un **LLM (Large Language Model)**.

Su principal objetivo es proporcionar respuestas más precisas, actualizadas y fundamentadas utilizando información recuperada desde documentos, bases de conocimiento o repositorios de información.

En lugar de depender únicamente del conocimiento con el que fue entrenado el modelo, RAG permite incorporar contexto adicional en tiempo real antes de generar una respuesta.

---

## 🏗️ Flujo General de RAG

```mermaid
flowchart TD

    A["Documento fuente"]
    B["Proceso de chunking cortar en pedazos"]

    A --> B

    subgraph DATA["Tipos de datos"]

        C["Chunk
        id
        content
        metadata
        source
        heading
        position
        charCount"]

        D["SearchResult
        chunk es Chunk
        score es number"]

        E["RetrievedChunk
        extiende Chunk
        agrega score"]

    end

    B --> C

    F["Indexacion
    Embeddings
    Vector DB"]

    G["Consulta del usuario"]

    H["Embedding de la consulta"]

    I["Busqueda semantica
    en Vector DB"]

    J["Transformacion a
    RetrievedChunk"]

    C --> F

    G --> H

    F --> I
    H --> I

    I --> D

    D --> J

    J --> E

    K["Seleccion de top k chunks"]

    L["Construccion de contexto"]

    M["Prompt enriquecido
    RAG"]

    N["LLM genera respuesta"]

    E --> K
    K --> L
    L --> M
    M --> N

    classDef ingest fill:#1976D2,color:#ffffff,stroke:#0D47A1,stroke-width:2px;
    classDef model fill:#388E3C,color:#ffffff,stroke:#1B5E20,stroke-width:2px;
    classDef retrieval fill:#F57C00,color:#ffffff,stroke:#E65100,stroke-width:2px;
    classDef generation fill:#7B1FA2,color:#ffffff,stroke:#4A148C,stroke-width:2px;

    class A,B ingest;
    class C,D,E model;
    class F,G,H,I,J retrieval;
    class K,L,M,N generation;
```

### 🎨 Leyenda del Diagrama

🔵 **Azul** → Ingesta y preparación de documentos.  
🟢 **Verde** → Estructuras de datos (`Chunk`, `SearchResult`, `RetrievedChunk`).  
🟠 **Naranja** → Embeddings, indexación y recuperación semántica.  
🟣 **Morado** → Construcción del contexto y generación de la respuesta.

---

### 📥 1. Ingesta del documento

Todo comienza con un **documento fuente**.

Este documento puede provenir de diferentes orígenes:

- 📄 PDF
- 🌐 Página web
- 📚 Base de conocimiento
- 📖 Documentación técnica
- 📝 Archivos Markdown
- 💾 Repositorios locales

Los modelos de lenguaje poseen límites de contexto, por lo que documentos muy grandes no pueden procesarse de una sola vez.

Para resolver este problema se utiliza una técnica llamada **chunking**, que consiste en dividir el contenido en fragmentos más pequeños llamados **chunks**.

#### Beneficios

- ✅ Reduce el tamaño de los documentos.
- ✅ Mejora la precisión de búsqueda.
- ✅ Permite recuperar únicamente las secciones relevantes.

---

### 📦 2. Creación de los objetos de datos

Cada fragmento generado durante el proceso de chunking se representa mediante una estructura denominada **Chunk**.

Un `Chunk` almacena:

- Un identificador (`id`).
- El contenido textual (`content`).
- Metadatos (`metadata`).

#### Ejemplo de metadatos

- Documento de origen (`source`).
- Título o encabezado (`heading`).
- Posición dentro del documento (`position`).
- Número de caracteres (`charCount`).

#### ¿Por qué son importantes los metadatos?

Los metadatos permiten:

- 🔍 Identificar el origen de la información.
- 📍 Determinar dónde se encontraba dentro del documento.
- 📚 Mostrar referencias al usuario.
- 🧩 Construir contexto de mejor calidad.

---

### 🧮 3. Indexación en la base vectorial

Una vez creados los chunks, cada uno es convertido a un vector numérico mediante un modelo de [embedding](./embedding.md).

#### ¿Qué hacen los embeddings?

Los embeddings transforman texto en representaciones matemáticas capaces de capturar significado semántico.

Por ejemplo:

```text
"¿Cómo funciona una Vector DB?"
```

y

```text
"¿Qué es una base de datos vectorial?"
```

pueden generar vectores muy cercanos aunque utilicen palabras distintas.

#### Resultado

```text
Chunk
    ↓
Embedding
    ↓
Vector DB
```

Los vectores generados se almacenan en una **Vector Database (Vector DB)** junto con la referencia al chunk original.

---

### ❓ 4. Procesamiento de la consulta

Cuando un usuario realiza una pregunta ocurre el siguiente flujo:

1. 📥 Se recibe la consulta.
2. 🧮 Se genera un embedding de la consulta.
3. 🔗 Se utiliza el mismo modelo de embeddings empleado durante la indexación.

#### Objetivo

Representar tanto documentos como preguntas dentro del mismo espacio vectorial.

Gracias a ello resulta posible comparar similitud semántica entre ambos.

---

### 🔍 5. Búsqueda semántica

Ahora la aplicación compara:

```text
Embedding del usuario
```

contra

```text
Embeddings almacenados en la Vector DB
```

La búsqueda devuelve los fragmentos conceptualmente más cercanos a la consulta.

#### Resultado obtenido

La búsqueda genera objetos:

```text
SearchResult
```

que contienen:

- El chunk encontrado.
- El grado de similitud (`score`).

#### Ventaja principal

A diferencia de una búsqueda tradicional por palabras clave, la búsqueda semántica encuentra información relacionada por significado.

---

### 📊 6. Conversión a resultados enriquecidos

Los resultados de búsqueda se transforman en objetos **RetrievedChunk**.

Un `RetrievedChunk` contiene:

- Toda la información del `Chunk`.
- La puntuación de relevancia (`score`).

#### Beneficios

- 📈 Permite ordenar resultados.
- 🎯 Facilita seleccionar los elementos más relevantes.
- 🧠 Mejora la calidad del contexto final.

---

### 🏆 7. Selección de los mejores fragmentos

No todos los chunks recuperados son utilizados.

El sistema selecciona únicamente los de mayor relevancia mediante una estrategia conocida como:

```text
Top-K Retrieval
```

Donde:

- `K = 3` → 3 fragmentos.
- `K = 5` → 5 fragmentos.
- `K = 10` → 10 fragmentos.

La cantidad exacta depende de la configuración del sistema.

#### Objetivo

Maximizar la calidad de la información enviada al modelo evitando ruido innecesario.

---

### 🧩 8. Construcción del contexto

Los chunks seleccionados se combinan para crear un contexto enriquecido.

```text
Chunk 1
+
Chunk 2
+
Chunk 3
=
Contexto
```

Este contexto representa la información más relevante para responder la consulta realizada por el usuario.

---

### 📝 9. Creación del Prompt RAG

El contexto recuperado se incorpora al prompt enviado al LLM.

El resultado es un **Prompt Enriquecido** que contiene:

- ❓ Pregunta del usuario.
- 📚 Fragmentos recuperados.
- ⚙️ Instrucciones del sistema.
- 🎯 Reglas de comportamiento.

#### Ejemplo conceptual

```text
Contexto:
[Información recuperada]

Pregunta:
¿Cómo funciona RAG?

Instrucciones:
Responde utilizando únicamente el contexto proporcionado.
```

---

### 🤖 10. Generación de la respuesta

Finalmente el LLM procesa:

- 🧠 Su conocimiento general.
- 📚 El contexto recuperado.
- ❓ La pregunta realizada.

Y genera una respuesta final.

#### Beneficios

✅ Respuestas más precisas.  
✅ Información respaldada por documentación real.  
✅ Menor probabilidad de alucinaciones.  
✅ Mejor aprovechamiento del conocimiento corporativo.  
✅ Posibilidad de utilizar información reciente sin reentrenar el modelo.

---

## 🔄 Resumen Visual del Proceso

```text
Documento
    ↓
Chunking
    ↓
Chunks
    ↓
Embeddings
    ↓
Vector DB

Pregunta
    ↓
Embedding
    ↓
Busqueda Semantica
    ↓
Top K Chunks
    ↓
Contexto
    ↓
Prompt RAG
    ↓
LLM
    ↓
Respuesta
```

---

## ✅ Ventajas de utilizar RAG

### 📚 Información actualizada

Permite utilizar conocimiento que no estaba presente durante el entrenamiento del modelo.

### 🎯 Mayor precisión

Recupera información relevante antes de generar la respuesta.

### 🔍 Trazabilidad

Es posible identificar el origen de la información utilizada.

### 💰 Menor costo

No es necesario reentrenar un modelo para incorporar nueva documentación.

### 🏢 Ideal para entornos empresariales

Permite consultar documentación interna, manuales, procedimientos, bases de conocimiento y repositorios corporativos.

---

## 🎯 Conclusión

RAG combina lo mejor de dos mundos:

- 🔎 Recuperación inteligente de información.
- 🤖 Generación de lenguaje natural mediante LLMs.

Gracias a esta arquitectura, los modelos pueden responder utilizando conocimiento específico y actualizado, aumentando significativamente la calidad, precisión y confiabilidad de las respuestas.

---

## ✅ Resultado del proceso

```txt
╔══════════════════════╗
║      Rag Agent       ║
╚══════════════════════╝
✅ Demo 1: Consulta Agente con RAG

💬 Escribe tu pregunta y presiona Enter.
💡 Tip: usa /ingest para cargar documentación
   Comandos: /ingest [path], /clear, /stats, /tools, /exit
```

**Tú:** /ingest

```txt
Iniciando la ingestión de documentos..
Directorio: ./docs/sample_docs

Procesando api-reference.md... 26 chunks generados
Procesando getting-started.md... 23 chunks generados
Procesando README.md... 17 chunks generados
Total de chunks generados 66
Generando embeddings para 66 chunks...
Embeddings generados 1536 dimensiones c/u

Guardando en vector store SQLite: ./data/vectors.db
Vector store guardado 66 chunks en ./data/vectors.db

Total: 66 chunks procesados

Preview en: data\chunks-preview.json

Ingestión completa, listo para la búsqueda semántica

Ingesta completada correctamente.
```

**Tú:** Como hacer un primer request?

**Asistente:**

```txt
Buscando: "Como hacer un primer request?" -> 5 chunks recuperados

Contexto recuperado de:
-> getting-started.md ((Contenido))
-> api-reference.md (## Rate Limiting)
-> api-reference.md ((Contenido))
```

Para hacer tu primera request a la API de TaskFlow, puedes utilizar el siguiente comando `curl` para verificar que la API está respondiendo:

```bash
curl https://api.taskflow.app/v1/health
```

La respuesta esperada debería ser:

```json
{ "status": "ok", "version": "1.4.2" }
```

Esto lo puedes encontrar en la documentación en el archivo **getting-started.md**, sección **(Contenido)**, Paso 2.

**Tú:** Como se realiza la Autenticacion?

**Asistente:**

```txt
Buscando: "Como se realiza la Autenticacion?" -> 5 chunks recuperados

Contexto recuperado de:
-> getting-started.md ((Contenido))
-> api-reference.md (## Autenticación)
-> getting-started.md (## Autenticación con JWT)
-> api-reference.md ((Contenido))
```

Para realizar la autenticación en la API de TaskFlow, sigue estos pasos:

1. **Envía una petición de inicio de sesión** usando el siguiente comando `curl`:

   ```bash
   curl -X POST https://api.taskflow.app/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "tu@email.com",
       "password": "tu-contraseña"
     }'
   ```

2. **Guarda el `accessToken` de la respuesta**, que se utilizará en los headers de cada request:

   ```bash
   export TASKFLOW_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

3. **Utiliza el `accessToken` en los headers** de tus requests a los endpoints protegidos.

4. **Cuando el `accessToken` expire**, puedes obtener uno nuevo mediante una petición con el `refreshToken`:

   ```bash
   curl -X POST https://api.taskflow.app/v1/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{
       "refreshToken": "tu-refresh-token"
     }'
   ```

Esta información proviene del archivo **getting-started.md**, sección **(Contenido)**, Paso 3, y del archivo **api-reference.md**, sección **## Autenticación**.

**Tú:** Explicame los Features

**Asistente:**

```txt
Buscando: "Explicame los Features" -> 5 chunks recuperados

Contexto recuperado de:
-> readme.md (## Features principales)
-> readme.md (## Contribución)
-> getting-started.md (## Preguntas Frecuentes (FAQ))
-> api-reference.md (## Proyectos)
-> api-reference.md (## Tareas)
```

Los principales features de TaskFlow son:

- **Gestión de tareas**: Permite realizar operaciones CRUD (Crear, Leer, Actualizar, Eliminar) en tareas, incluyendo la gestión de prioridades, fechas límite, etiquetas y estados.

- **Proyectos**: Facilita la organización de tareas dentro de proyectos, permitiendo la asignación de miembros y permisos.

- **Colaboración**: Posibilita la asignación de tareas, la posibilidad de comentar y recibir notificaciones en tiempo real.

- **Webhooks**: Permite integrar TaskFlow con cualquier sistema externo, facilitando la comunicación y la automatización.

- **SDKs oficiales**: Ofrece kits de desarrollo (SDKs) en JavaScript/TypeScript y Python para facilitar su uso.

- **Rate limiting**: Establece un límite de 100 requests por minuto para cada usuario autenticado.

- **Paginación cursor-based**: Proporciona un manejo eficiente de colecciones grandes mediante paginación basada en cursor.

Esta información se encuentra en el archivo **readme.md**, sección **## Features principales**.

**Tú:** /stats

```txt
📊 Estadísticas de la conversación:
   • Turnos: 3
   • Tokens de entrada acumulados: 4472
   • Tokens de salida acumulados: 628
   • Tokens estimados en contexto actual: 2028
```

**Tú:** Como funciona el Modelo de Tarea?

**Asistente:**

```txt
Buscando: "Como funciona el Modelo de Tarea?" -> 5 chunks recuperados

Contexto recuperado de:
-> api-reference.md ((Contenido))
-> api-reference.md (## Tareas)
-> readme.md ((Contenido))
-> readme.md (## Features principales)
```

El modelo de tarea en la API de TaskFlow está definido por la siguiente estructura:

```typescript
interface Task {
  id: string; // Identificador único de la tarea, ej. "tsk_01HXYZ123"
  title: string; // Título de la tarea, máximo 255 caracteres
  description?: string; // Descripción opcional, máximo 10,000 caracteres (puede usar Markdown)
  status: "todo" | "in_progress" | "done" | "cancelled"; // Estado de la tarea
  priority: "low" | "medium" | "high" | "urgent"; // Prioridad de la tarea
  projectId?: string; // Identificador del proyecto al que pertenece la tarea, opcional
  assigneeId?: string; // Identificador del usuario asignado a la tarea, opcional
  creatorId: string; // Identificador del usuario que creó la tarea
  dueDate?: string; // Fecha de vencimiento en formato ISO 8601, opcional
  tags: string[]; // Etiquetas asociadas a la tarea
  createdAt: string; // Fecha de creación de la tarea
  updatedAt: string; // Fecha de última actualización de la tarea
}
```

### Descripción de los campos:

- **id**: Identificación única de la tarea.
- **title**: Título que describe la tarea.
- **description**: Descripción detallada, no obligatoria.
- **status**: Indica el progreso de la tarea (por ejemplo, 'todo', 'in_progress', etc.).
- **priority**: Define la importancia de la tarea.
- **projectId**: Referencia al proyecto al que la tarea está ligada, si es aplicable.
- **assigneeId**: Identifica al usuario que tiene la tarea asignada.
- **creatorId**: Identifica al creador de la tarea.
- **dueDate**: Fecha límite para completar la tarea.
- **tags**: Lista de etiquetas para categorizar la tarea.
- **createdAt**: Marca de tiempo cuando se creó la tarea.
- **updatedAt**: Marca de tiempo de la última vez que se actualizó la tarea.

Esta información se encuentra en el archivo **api-reference.md**, sección **### Modelo de Tarea**.

**Tú:** Como se manejan los tokens?

**Asistente:**

```txt
Buscando: "Como se manejan los tokens?" -> 5 chunks recuperados

Contexto recuperado de:
-> api-reference.md ((Contenido))
-> getting-started.md (## Autenticación con JWT)
-> api-reference.md (## Autenticación)
```

El manejo de tokens en la API de TaskFlow se realiza de la siguiente manera:

### Obtener un token

Para obtener un `accessToken`, se debe enviar una solicitud de inicio de sesión:

```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "tu-contraseña"
}
```

La respuesta exitosa incluirá el `accessToken` y un `refreshToken`:

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### Usar el token

El `accessToken` debe incluirse en el header `Authorization` de cada request:

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Renovar el token

El `accessToken` expira en 15 minutos. Para obtener un nuevo `accessToken`, se debe usar el `refreshToken`:

```http
POST /v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Esta información se encuentra en el archivo **api-reference.md**, sección **## Autenticación** y en las secciones relacionadas sobre obtener y renovar el token.

**Tú:** /stats

```txt
📊 Estadísticas de la conversación:
   • Turnos: 5
   • Tokens de entrada acumulados: 11838
   • Tokens de salida acumulados: 1472
   • Tokens estimados en contexto actual: 3868
```

**Tú:** /exit

```txt
Resumen: 5 turnos, 11838 tokens de entrada, 1472 tokens de salida.
```

---

### 📖 Resumen

**RAG funciona dividiendo documentos en fragmentos, transformándolos en embeddings, almacenándolos en una base de datos vectorial, recuperando los fragmentos más relevantes para una consulta y utilizándolos como contexto adicional para que el LLM genere respuestas mejor fundamentadas.**

---

[REGRESAR](../README.md)
