# 🧠 Modelo `text-embedding-3-small`

## ¿Qué es?

`text-embedding-3-small` es un modelo de **embeddings de texto desarrollado por OpenAI**.

Su función es recibir texto y transformarlo en un vector numérico que representa sus características semánticas.

```text
Texto de entrada
       │
       ▼
text-embedding-3-small
       │
       ▼
Vector numérico
[0.018, -0.032, 0.007, ...]
```

El modelo no genera respuestas conversacionales, no razona sobre una pregunta y no redacta contenido.

Su salida es una representación matemática del texto que puede ser almacenada, comparada y procesada por una aplicación.

---

## ⚙️ Características principales

| Característica              | Descripción                                                   |
| --------------------------- | ------------------------------------------------------------- |
| Proveedor                   | OpenAI                                                        |
| Identificador               | `text-embedding-3-small`                                      |
| Tipo                        | Modelo de embeddings                                          |
| Entrada                     | Texto                                                         |
| Salida                      | Vector numérico                                               |
| Dimensiones predeterminadas | `1536`                                                        |
| Tamaño máximo de entrada    | `8191` tokens                                                 |
| Enfoque                     | Eficiencia, velocidad y bajo costo                            |
| Uso habitual                | Búsqueda semántica, RAG, clasificación y agrupación de textos |

`text-embedding-3-small` reemplaza a `text-embedding-ada-002` como la alternativa pequeña y eficiente de OpenAI para generar embeddings.

---

## 📐 Dimensiones del vector

De manera predeterminada, el modelo genera un vector de **1536 dimensiones**.

```text
[
  0.0182,
  -0.0341,
  0.0075,
  ...
]
```

**NOTA**: El modelo permite solicitar un vector con menos dimensiones mediante el parámetro `dimensions`.

```json
{
  "model": "text-embedding-3-small",
  "input": "Arquitectura limpia con NestJS",
  "dimensions": 512
}
```

Cada número representa una característica aprendida por el modelo.

Un valor individual no tiene un significado útil por sí solo. La representación semántica se encuentra distribuida en el vector completo.

```text
Texto
  │
  ▼
Vector de 1536 posiciones
  │
  ├── valor 1
  ├── valor 2
  ├── valor 3
  └── ...
```

Los textos con significados parecidos tienden a producir vectores cercanos dentro del espacio vectorial.

```text
"Proteger una API con JWT"
             │
             ├──── vectores cercanos
             │
"Autenticación mediante tokens"
```

En cambio, textos sin relación semántica deberían quedar más alejados.

```text
"Proteger una API con JWT"
             │
             └──── vectores alejados
             │
"Receta de pastel de chocolate"
```

---

## 🌍 Soporte multilingüe

`text-embedding-3-small` puede representar textos escritos en distintos idiomas.

Esto permite comparar contenido aunque los textos no estén escritos en el mismo idioma o no utilicen exactamente las mismas palabras.

```text
"Cómo autenticar usuarios"
            │
            ├── significado relacionado
            │
"How to authenticate users"
```

---

## 📥 Entrada del modelo

El modelo puede recibir una cadena de texto:

```json
{
  "model": "text-embedding-3-small",
  "input": "Configuración de autenticación con JWT"
}
```

También puede procesar varias cadenas en una misma solicitud:

```json
{
  "model": "text-embedding-3-small",
  "input": [
    "Configuración de autenticación con JWT",
    "Creación de migraciones con TypeORM",
    "Procesamiento de pagos con Stripe"
  ]
}
```

Cada texto produce su propio vector.

```text
Texto 1 ──► Vector 1
Texto 2 ──► Vector 2
Texto 3 ──► Vector 3
```

---

## 📤 Salida del modelo

La respuesta contiene una colección de embeddings:

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0182, -0.0341, 0.0075]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

Los campos principales son:

| Campo       | Descripción                             |
| ----------- | --------------------------------------- |
| `data`      | Lista de resultados generados           |
| `embedding` | Vector numérico producido por el modelo |
| `index`     | Posición de la entrada correspondiente  |
| `model`     | Modelo utilizado                        |
| `usage`     | Cantidad de tokens procesados           |

---

## 🎯 ¿Para qué se utiliza?

`text-embedding-3-small` puede utilizarse en sistemas que necesitan comparar o recuperar información por significado.

### Búsqueda semántica

Permite buscar contenido relacionado aunque no existan coincidencias exactas entre las palabras.

```text
Consulta:
"¿Cómo protejo mis endpoints?"

Documento encontrado:
"Autenticación de APIs mediante JWT"
```

### RAG

Permite encontrar los fragmentos de documentación más relacionados con una pregunta antes de enviarlos a un modelo generativo.

```text
Pregunta
   │
   ▼
text-embedding-3-small
   │
   ▼
Vector de la pregunta
   │
   ▼
Búsqueda vectorial
   │
   ▼
Documentos relevantes
```

### Similitud de textos

Permite detectar textos que expresan una intención parecida.

```text
"Olvidé mi contraseña"
"Necesito recuperar el acceso a mi cuenta"
```

### Clasificación

Permite comparar un texto con categorías previamente representadas mediante embeddings.

```text
Mensaje:
"Me cobraron dos veces"

Categoría más cercana:
Facturación
```

### Agrupación

Permite organizar automáticamente documentos, mensajes o registros que tratan temas similares.

---

## ✅ ¿Por qué usar `text-embedding-3-small`?

`text-embedding-3-small` ofrece un equilibrio práctico entre **calidad semántica, costo, velocidad y facilidad de integración**.

Sus principales ventajas son:

- No requiere descargar ni ejecutar el modelo localmente.
- No necesita administrar CPU, GPU o memoria para la inferencia.
- Produce embeddings adecuados para muchos sistemas RAG.
- Tiene buen rendimiento con contenido multilingüe.
- Permite reducir las dimensiones del vector.
- Puede procesar varias entradas en una sola solicitud.
- Su costo es bajo en comparación con modelos generativos.
- Se integra fácilmente con bases de datos vectoriales.
- Permite concentrarse en el flujo de recuperación sin administrar infraestructura de modelos.

```text
Aplicación
   │
   ▼
API de OpenAI
   │
   ▼
text-embedding-3-small
   │
   ▼
Vector
   │
   ▼
Base de datos vectorial
```

Es una opción adecuada cuando se quiere desarrollar rápidamente una primera implementación de:

- RAG.
- Búsqueda semántica.
- Clasificación de textos.
- Recomendación de contenido.
- Detección de documentos similares.

Su principal desventaja es que depende de un servicio externo. El texto debe enviarse a la API de OpenAI y la aplicación necesita conexión a Internet.

---

## 🔄 Modelos equivalentes en otros proveedores

No todos los proveedores de modelos generativos ofrecen una API propia de embeddings.

| Proveedor o plataforma | Modelos de embeddings                                                              | Disponibilidad | Observación                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| **OpenAI**             | `text-embedding-3-small`, `text-embedding-3-large`                                 | ✅ Sí          | Servicio administrado mediante la API de OpenAI                                                   |
| **Anthropic**          | No ofrece modelos propios de embeddings                                            | ❌ No          | Claude puede consumir contexto recuperado, pero los embeddings deben generarse con otro proveedor |
| **Gemini**             | `gemini-embedding-001`, `gemini-embedding-2`                                       | ✅ Sí          | Ofrece embeddings de texto y embeddings multimodales                                              |
| **Groq**               | No ofrece actualmente un endpoint propio de embeddings                             | ❌ No          | Debe combinarse con OpenAI, Gemini, Ollama u otro proveedor                                       |
| **Ollama**             | `embeddinggemma`, `qwen3-embedding`, `all-minilm`, `nomic-embed-text`, entre otros | ✅ Sí          | Permite ejecutar modelos de embeddings localmente                                                 |

Anthropic documenta el uso de proveedores externos para generar embeddings, ya que Claude no dispone de un modelo propio para esta tarea.

Gemini ofrece modelos especializados para embeddings. `gemini-embedding-001` está orientado al procesamiento de texto, mientras que `gemini-embedding-2` puede representar texto, imágenes, audio, video y documentos dentro de un espacio vectorial unificado.

La documentación y el catálogo actual de Groq se concentran en modelos generativos y no incluyen un endpoint específico de embeddings.

Ollama dispone del endpoint local `/api/embed` y recomienda modelos como `embeddinggemma`, `qwen3-embedding` y `all-minilm`.

---

## 🧱 Separación entre embeddings y generación

El modelo utilizado para generar embeddings no tiene que pertenecer al mismo proveedor que el modelo encargado de redactar la respuesta.

```text
Modelo de embeddings
        │
        ▼
Recuperación de documentos
        │
        ▼
Modelo generativo
        │
        ▼
Respuesta
```

Por ejemplo, una aplicación puede utilizar:

```text
OpenAI
└── text-embedding-3-small
    └── Generación de embeddings

Anthropic
└── Claude
    └── Generación de respuestas
```

También puede utilizar:

```text
Ollama
└── embeddinggemma
    └── Embeddings locales

Groq
└── Modelo generativo
    └── Generación rápida de respuestas
```

Esta separación permite elegir cada modelo según su función, costo, privacidad y rendimiento.

---

[RAG](./rag.md) || [REGRESAR - EMBEDDING](./embedding.md) || [SIGUIENTE - CHUNKING](./chunking.md)
