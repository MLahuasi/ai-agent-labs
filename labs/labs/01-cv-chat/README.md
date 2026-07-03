## 🧰 Agente con Tools y Evaluación de Respuestas

Este laboratorio implementa un agente conversacional basado en un LLM, diseñado para responder preguntas a partir de fuentes locales, ejecutar herramientas cuando la conversación lo requiere y validar la calidad de sus respuestas antes de entregarlas al usuario.

El objetivo principal es explorar dos capacidades importantes en la construcción de agentes de IA:

### 🛠️ Uso de tools dentro del agente

El agente puede decidir cuándo necesita utilizar una herramienta para completar una acción específica.

En este laboratorio, las tools disponibles permiten:

- Registrar detalles del usuario.
- Registrar preguntas desconocidas o que no pudieron ser respondidas con la información disponible.
- Enviar un email al administrador.

Estas tools permiten que el agente no se limite únicamente a generar texto, sino que también pueda ejecutar acciones concretas dentro del flujo de conversación.

### ✅ Evaluación automática de respuestas

El laboratorio incorpora un evaluador de respuestas encargado de revisar si la respuesta generada por el agente cumple con los criterios esperados.

Si la respuesta es aceptable, se entrega al usuario.

Si la respuesta no es aceptable, el flujo permite corregirla y generar una versión mejorada antes de responder.

### 🧠 Flujo general del laboratorio

El laboratorio integra:

- Carga de contexto desde fuentes locales.
- Construcción de prompts para el agente.
- Configuración del LLM.
- Uso opcional de tools.
- Evaluación automática de respuestas.
- Corrección de respuestas cuando no cumplen los criterios definidos.
- Manejo del historial de conversación.

Este enfoque permite simular una arquitectura más cercana a un agente real, donde el modelo puede razonar, decidir si necesita usar herramientas, ejecutar acciones y validar la calidad de sus respuestas antes de interactuar finalmente con el usuario.

```mermaid
flowchart TD
    U[Usuario] --> CHANNEL[Canal de comunicación]

    CHANNEL --> CHAT_START[Inicio flujo conversación del agente]

    subgraph INIT["Config Agente"]
        MAIN[Main]
        MAIN --> LLM_CONFIG[LLM configurado]
        MAIN --> LOCAL[Cargar fuentes]
        MAIN --> PROMPTS[Construcción de prompts]
        MAIN --> TOOLS_DEF[Tools disponibles]
        MAIN --> LOAD_HISTORY[Cargar historial]
    end

    STORED_HISTORY[(Historial almacenado)] --> LOAD_HISTORY

    LOCAL --> PROMPTS
    PROMPTS --> CHAT_START
    LLM_CONFIG --> CHAT_START
    TOOLS_DEF --> CHAT_START
    LOAD_HISTORY --> CHAT_START

    CHAT_START --> TOOL_CHECK{¿El agente solicita usar una tool?}

    TOOL_CHECK -- Sí --> TOOL_HANDLER[Ejecutar tool]

    subgraph AGENT_TOOLS[" "]
        TOOL_HANDLER --> USER_DETAILS[Registrar detalles de Usuario]
        TOOL_HANDLER --> UNKNOWN_QUESTION[Registrar preguntas desconocidas]
        TOOL_HANDLER --> ADMIN_EMAIL[Enviar Email a Administrador]
    end

    USER_DETAILS --> SEND_EMAIL[Envía un Email]
    UNKNOWN_QUESTION --> SEND_EMAIL
    ADMIN_EMAIL --> SEND_EMAIL

    SEND_EMAIL --> REPLY_USER[Responder a usuario]
    REPLY_USER --> SAVE_HISTORY[Guardar historial]

    TOOL_CHECK -- No --> EVALUATE_RESPONSE[Evaluar Respuesta]

    EVALUATE_RESPONSE --> ACCEPTED{¿Respuesta aceptable?}

    ACCEPTED -- Sí --> SAVE_HISTORY

    ACCEPTED -- No --> FIX_RESPONSE[Corregir respuesta]
    FIX_RESPONSE --> SAVE_HISTORY

    SAVE_HISTORY --> STORED_HISTORY
    SAVE_HISTORY --> CHANNEL
```

[REGRESAR](../../../fundamentos/README.md) | [VER EJEMPLO](./main.py)
