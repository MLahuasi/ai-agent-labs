# 🧮 ¿Qué es un Embedding?

Un **embedding** es una representación numérica (un vector de números) que captura el significado semántico de un texto.

En lugar de almacenar una frase como texto, un modelo la convierte en una lista de números que representa su significado dentro de un espacio matemático multidimensional.

Los modelos de IA no comprenden palabras de la misma forma que las personas. Para poder procesarlas, transforman el texto en vectores numéricos que permiten realizar operaciones matemáticas y medir similitudes entre conceptos.

Por ejemplo:

```text
"¿Cómo funciona RAG?"
↓
[0.145, -0.827, 0.392, ...]
```

Aunque este vector no es legible para los humanos, permite a las computadoras comparar el significado de distintos textos de manera eficiente.

---

## 🤔 ¿Por qué se usan embeddings?

Los embeddings permiten identificar textos relacionados aunque no utilicen exactamente las mismas palabras.

Esto hace posible realizar búsquedas por significado y no únicamente por coincidencia de palabras clave.

Por ejemplo:

```text
Consulta:
"¿Cómo funciona una base de datos vectorial?"
```

y

```text
Documento:
"Las Vector DB almacenan representaciones semánticas de documentos."
```

Aunque las frases son diferentes, sus embeddings estarán relativamente cerca en el espacio vectorial porque ambos textos hablan sobre conceptos similares.

#### ✅ Ventaja principal

Un motor de búsqueda tradicional podría no detectar la relación entre ambas frases.

Una búsqueda basada en embeddings sí puede encontrar esa relación gracias a la similitud semántica.

---

## 🔎 ¿Qué significa en el contexto de RAG?

En una arquitectura **RAG (Retrieval-Augmented Generation)**, los embeddings son uno de los componentes más importantes.

Permiten convertir tanto los documentos como las preguntas de los usuarios en representaciones matemáticas comparables.

De esta forma, el sistema puede recuperar información relevante antes de generar una respuesta.

---

### 📚 1. Durante la indexación

Cada **Chunk** generado a partir de la documentación se transforma en un embedding.

```text
Chunk
↓
Embedding
↓
Vector DB
```

Por ejemplo:

```text
Chunk:
"RAG combina recuperación de información y generación de texto."

Embedding:
[0.54, -0.23, 0.88, ...]
```

Este vector se almacena posteriormente dentro de una base de datos vectorial (**Vector DB**).

#### 🎯 Objetivo

Representar el significado del contenido de forma que pueda encontrarse posteriormente mediante búsquedas semánticas.

---

### ❓ 2. Cuando llega una pregunta

La consulta realizada por el usuario también se convierte en un embedding.

```text
Pregunta del usuario
↓
Embedding de la consulta
```

Por ejemplo:

```text
Pregunta:
"¿Para qué sirve RAG?"

Embedding:
[0.52, -0.21, 0.90, ...]
```

Utilizando el mismo modelo de embeddings tanto para documentos como para consultas, ambos quedan representados en el mismo espacio vectorial.

#### ✅ Resultado

Ahora es posible comparar documentos y preguntas matemáticamente.

---

### 🔍 3. Búsqueda semántica

La Vector DB compara el embedding de la consulta con los embeddings almacenados para todos los chunks indexados.

```text
Embedding consulta
        ↓
Comparación de similitud
        ↓
Embeddings de chunks
```

Los chunks cuyos vectores se encuentran más cerca del embedding de la consulta se consideran más relevantes.

#### Ejemplo conceptual

```text
Pregunta:
"¿Cómo funciona RAG?"

Chunk A:
"Arquitectura de sistemas RAG"
✔ Muy cercano

Chunk B:
"Configuración de Docker"
✖ Poco relacionado
```

El sistema recuperará prioritariamente el **Chunk A** debido a su mayor similitud semántica.

---

## 🧭 Analogía sencilla

Imagina una enorme biblioteca organizada como un mapa tridimensional.

- 📚 El texto original es el libro.
- 📍 El embedding representa la ubicación del libro dentro del mapa.
- 🤝 Los documentos sobre temas similares quedan cerca unos de otros.
- 🚀 Los documentos sobre temas distintos quedan alejados.

Cuando una persona realiza una pregunta:

1. La pregunta se convierte en un embedding.
2. El embedding se coloca dentro del mismo mapa.
3. El sistema busca las posiciones más cercanas.
4. Recupera los documentos relacionados.
5. Envía esos documentos al LLM como contexto.

De esta forma, el modelo recibe exactamente la información que necesita para responder.

---

## 📐 ¿Cómo se mide la similitud?

Una vez transformados en vectores, los embeddings pueden compararse utilizando métricas matemáticas.

Las más comunes son:

- 📊 Cosine Similarity
- 📏 Euclidean Distance
- 📈 Dot Product

Estas métricas permiten determinar qué tan similares son dos textos desde el punto de vista semántico.

#### Ejemplo conceptual

```text
Consulta:
"¿Qué es una Vector DB?"

Chunk 1:
"Las bases de datos vectoriales almacenan embeddings."
→ Similitud alta

Chunk 2:
"Cómo configurar Git."
→ Similitud baja
```

---

## ⚙️ Embeddings y Bases de Datos Vectoriales

Los embeddings son el elemento que hace posible el funcionamiento de las **Vector Databases**.

Una Vector DB está diseñada para:

- Almacenar millones de embeddings.
- Buscar vectores similares rápidamente.
- Escalar búsquedas semánticas.
- Recuperar información relevante para sistemas RAG.

#### Flujo simplificado

```text
Documento
↓
Embedding
↓
Vector DB

Pregunta
↓
Embedding
↓
Busqueda de similitud

Top resultados
↓
Contexto para el LLM
```

---

## 🚀 Beneficios de los Embeddings

### 🔎 Búsquedas por significado

Permiten localizar información relacionada aunque no coincidan las palabras exactas.

### 🎯 Mejor recuperación de información

Incrementan la relevancia de los resultados obtenidos.

### 🧠 Comprensión semántica

Capturan conceptos y relaciones entre textos.

### ⚡ Alto rendimiento

Facilitan búsquedas rápidas incluso sobre grandes volúmenes de información.

### 📚 Fundamentales para RAG

Son uno de los pilares principales de cualquier sistema de recuperación semántica.

### 🤖 Mejor calidad de respuestas

Ayudan a proporcionar contexto más relevante para los LLMs.

---

## 🔄 Resumen Visual

```text
Texto
    ↓
Modelo de Embeddings
    ↓
Vector Numerico
    ↓
Vector DB
    ↓
Busqueda Semantica
    ↓
Chunks Relevantes
    ↓
Contexto RAG
    ↓
LLM
    ↓
Respuesta
```

---

### ✅ Resumen

Un **embedding** es una representación matemática del significado de un texto.

En una arquitectura RAG:

1. 📄 Los documentos se dividen en chunks.
2. 🧮 Cada chunk se transforma en un embedding.
3. 🗄️ Los embeddings se almacenan en una Vector DB.
4. ❓ La consulta del usuario también se transforma en un embedding.
5. 🔍 Se realiza una búsqueda semántica para encontrar los fragmentos más relevantes.
6. 🤖 Los resultados recuperados se utilizan como contexto para generar una respuesta.

Gracias a este mecanismo, los sistemas RAG pueden encontrar información por significado y no únicamente por coincidencia de palabras, mejorando significativamente la precisión y la calidad de las respuestas.

---

[RAG](./rag.md)
