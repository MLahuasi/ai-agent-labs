# 🧠 Fundamentos de IA Generativa

## 🤖 [System Prompt](./system-prompt.md)

Qué es un `System Prompt`, cómo influye en el comportamiento del modelo y cómo puede utilizarse para controlar el formato, el nivel de detalle y la calidad de las respuestas generadas.

## 📡 [Streaming de Respuestas](./streaming-response-flow.md)

Cómo los modelos de IA generan contenido de forma incremental y cómo el streaming permite mostrar una respuesta en tiempo real mientras se produce.

En esta sección se explica el flujo de eventos, la recepción de fragmentos o `chunks` y la construcción de la respuesta completa dentro de la aplicación.

## 📄 [Análisis de Archivos con un LLM](./analyze-file-with-llm.md)

Cómo validar, leer y enviar el contenido de un archivo a un modelo de lenguaje para procesarlo según las instrucciones definidas en el `System Prompt`.

Se estudian aspectos como validación de rutas y extensiones, control del tamaño del contenido, construcción del prompt, streaming y métricas de tokens.

## 💬 [Chat con un LLM](./chat.md)

Cómo mantener una conversación con historial, `System Prompt`, streaming y métricas de tokens.

## 🔀 [Orquestación de LLMs](./orquestacion-llms.md)

Cómo integrar, comparar y seleccionar distintos modelos de lenguaje dentro de una aplicación.

Se estudian conceptos como proveedores, modelos, abstracciones comunes y criterios para elegir el LLM más adecuado según el caso de uso.

## 🛠️ [Uso de Herramientas](./tools/use-tools.md)

Cómo un modelo o agente puede utilizar herramientas externas para ampliar sus capacidades, consultar información o ejecutar acciones específicas.

Se introducen conceptos como `tool calling`, definición de herramientas, validación de parámetros y procesamiento de resultados.

## 🔎 [RAG — Retrieval-Augmented Generation](./rag/rag.md)

Cómo un sistema `RAG` indexa documentación, realiza búsquedas semánticas y utiliza el contexto recuperado para mejorar las respuestas del modelo.

Se introduce la relación entre documentos, fragmentos, embeddings, búsqueda vectorial y generación de respuestas basadas en información externa.

## 🧩 [Agentes y Patrones Agénticos](./arquitectura-agentica.md)

Qué es un agente de IA, cuáles son sus componentes principales y cómo se relacionan los modelos, las instrucciones, las herramientas, el estado y el ciclo de ejecución.

También se introducen patrones agénticos como encadenamiento, enrutamiento, paralelización, orquestación y evaluación de resultados.

---

[REGRESAR](../../README.md)
