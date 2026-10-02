# 🧰 Manual técnico de uso del Agente

## 📚 Introducción

El Agente proporciona componentes reutilizables para interactuar con modelos de lenguaje, mantener conversaciones, procesar respuestas mediante streaming, revisar archivos, utilizar herramientas locales y consultar documentación mediante RAG.

Los ejemplos de este manual utilizan los mismos componentes disponibles en los laboratorios del proyecto, pero están planteados como ejemplos independientes para facilitar su reutilización.

Los componentes principales utilizados son:

- `LlmClient`
- `Conversation`
- `FileReviewer`
- `ToolDefinition`
- `ToolExecutionHandler`
- `RagPromptService`
- `runIngest`
- prompts de sistema
- configuración de ejecución

---

# 🚀 1. Inicialización del cliente LLM

El proyecto permite seleccionar el proveedor mediante la configuración de la aplicación.

La creación del cliente se realiza con:

```ts
import { validateConfig } from "./config/index.js";
import { createLlmProvider } from "./llm/llm.factory.js";

validateConfig();

const { client: llm, model } = createLlmProvider();

console.log(`Modelo seleccionado: ${model}`);
```

`createLlmProvider()` retorna:

```ts
{
  client: LlmClient;
  model: string;
}
```

El objeto `client` puede utilizarse posteriormente en todos los componentes que requieran un `LlmClient`.

Por ejemplo:

```ts
await llm.ask(...);

await llm.stream(...);
```

La aplicación puede cambiar de proveedor modificando su configuración sin cambiar el código de los laboratorios o componentes consumidores.

---

# ⚙️ 2. Configuración de las solicitudes

Las solicitudes al LLM utilizan varios límites comunes.

Los principales son:

| Propiedad        | Descripción                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `maxTokens`      | Máximo de tokens generados en una respuesta normal               |
| `maxTokensTools` | Máximo de tokens generados durante ejecuciones con tools         |
| `maxIterations`  | Máximo de iteraciones permitidas durante una ejecución con tools |
| `maxToolCalls`   | Máximo de llamadas a tools permitidas durante un turno           |

En los ejemplos de la aplicación estos valores pueden obtenerse desde `config`.

```ts
import { config } from "../config/index.js";
```

Ejemplo de una solicitud:

```ts
const response = await llm.ask({
  prompt: "Explica brevemente qué es Node.js",
  maxTokens: config.max_tokens,
  maxTokensTools: config.max_tokens_tools,
  maxIterations: config.max_iterations,
});
```

---

# 💬 3. Realizar una llamada simple al LLM

El método `ask()` permite realizar una solicitud y esperar la respuesta completa.

## Ejemplo

```ts
import { config } from "../config/index.js";
import { LlmClient } from "../types/app/index.js";

/**
 * Realiza una consulta simple al modelo.
 */
export async function runSimpleExample(llm: LlmClient): Promise<void> {
  const question =
    "Explica qué ventaja ofrece TypeScript en proyectos grandes. " +
    "Responde en tres puntos.";

  const response = await llm.ask({
    prompt: question,
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
  });

  console.log("Respuesta:");
  console.log(response.text);

  console.log("");
  console.log(`Tokens de entrada: ${response.totalInputTokens}`);
  console.log(`Tokens de salida: ${response.totalOutputTokens}`);
}
```

La respuesta contiene, entre otros datos:

```ts
response.text;
response.totalInputTokens;
response.totalOutputTokens;
response.toolsUsed;
response.toolCallsLastTurn;
```

Cuando la solicitud no utiliza tools:

```ts
response.toolCallsLastTurn === 0;
```

---

# 🎯 4. Utilizar un System Prompt

Un `systemPrompt` permite proporcionar instrucciones generales al modelo.

Es especialmente útil para definir:

- el rol del asistente;
- el formato esperado de las respuestas;
- reglas de comportamiento;
- criterios de revisión;
- restricciones de una tarea.

## Ejemplo

```ts
import { config } from "../config/index.js";
import { LlmClient } from "../types/app/index.js";

const SYSTEM_PROMPT = `
Actúa como asistente técnico de JavaScript.

Responde de forma breve.
Incluye ejemplos solamente cuando sean necesarios.
Utiliza terminología técnica clara.
`;

export async function runSystemPromptExample(llm: LlmClient): Promise<void> {
  const response = await llm.ask({
    prompt: "¿Qué diferencia existe entre map() y forEach()?",
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
  });

  console.log(response.text);
}
```

El `prompt` contiene la petición concreta del usuario.

El `systemPrompt` contiene instrucciones aplicables a la ejecución.

---

# 🌊 5. Generar respuestas mediante Streaming

El método `stream()` permite recibir la respuesta progresivamente.

Su uso es similar a `ask()`:

```ts
import { config } from "../config/index.js";
import { LlmClient } from "../types/app/index.js";

export async function runStreamingExample(llm: LlmClient): Promise<void> {
  const response = await llm.stream({
    prompt: "Resume las principales características de async/await.",
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
  });

  console.log("");
  console.log(`Tokens de entrada: ${response.totalInputTokens}`);
  console.log(`Tokens de salida: ${response.totalOutputTokens}`);
}
```

Durante el streaming, el cliente puede imprimir los fragmentos conforme son recibidos.

Al finalizar, el objeto retornado contiene las estadísticas completas de la solicitud.

---

# 🧠 6. Mantener una conversación

Para conversaciones con múltiples turnos se utiliza `Conversation`.

La clase conserva:

- mensajes del usuario;
- respuestas del asistente;
- consumo acumulado de tokens;
- número de turnos;
- llamadas a tools realizadas en el último turno.

## Crear una conversación

```ts
import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";

const conversation = new Conversation(
  "Eres un asistente especializado en documentación técnica.",
  {
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
    maxToolCalls: config.max_tool_calls,
  },
);
```

Después debe configurarse la función utilizada para consultar al LLM.

```ts
conversation.setAsk((request) => llm.stream(request));
```

También puede utilizarse una respuesta completa:

```ts
conversation.setAsk((request) => llm.ask(request));
```

---

## 💬 Enviar mensajes

```ts
const answer = await conversation.send("¿Qué es una Promise en JavaScript?");

console.log(answer);
```

En un segundo turno:

```ts
const answer = await conversation.send("¿Y cómo se relaciona con async/await?");
```

`Conversation` mantiene internamente el historial necesario para continuar el diálogo.

---

# 📜 7. Consultar el historial

El historial puede obtenerse con:

```ts
const history = conversation.getHistory();
```

Ejemplo:

```ts
for (const message of conversation.getHistory()) {
  const author =
    message.role === "user"
      ? "Usuario"
      : message.role === "assistant"
        ? "Asistente"
        : message.role;

  console.log(`${author}:`);
  console.log(message.content);
  console.log("");
}
```

Una salida típica sería:

```text
Usuario:
¿Qué es una Promise?

Asistente:
Una Promise representa el resultado futuro de una operación asíncrona.

Usuario:
¿Cómo se relaciona con async/await?

Asistente:
async/await proporciona una sintaxis más legible para trabajar con Promises.
```

---

# 📊 8. Consultar estadísticas de una conversación

Las estadísticas pueden consultarse con:

```ts
const stats = conversation.getStats();
```

El resultado incluye:

```ts
{
  inputTokens: number;
  outputTokens: number;
  turns: number;
  toolCallsLastTurn: number;
}
```

Ejemplo:

```ts
const stats = conversation.getStats();

console.log(`Turnos: ${stats.turns}`);
console.log(`Tokens entrada: ${stats.inputTokens}`);
console.log(`Tokens salida: ${stats.outputTokens}`);
console.log(`Tools utilizadas en el último turno: ${stats.toolCallsLastTurn}`);
```

También puede obtenerse una estimación del tamaño actual del historial:

```ts
const estimatedTokens = conversation.estimateCurrentTokens();

console.log(`Tokens estimados en contexto: ${estimatedTokens}`);
```

---

# 🧹 9. Limpiar una conversación

Para eliminar el historial y reiniciar sus estadísticas:

```ts
conversation.clear();
```

Después de ejecutar `clear()`:

- el historial queda vacío;
- los tokens acumulados vuelven a cero;
- los turnos vuelven a cero;
- `toolCallsLastTurn` vuelve a cero.

---

# 💻 10. Crear un chat interactivo

Un uso habitual de `Conversation` consiste en crear un pequeño chat de consola.

```ts
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";
import { LlmClient } from "../types/app/index.js";

export async function runChat(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
  });

  const conversation = new Conversation(
    "Eres un asistente de desarrollo de software.",
    {
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
      maxToolCalls: config.max_tool_calls,
    },
  );

  // La conversación transmite el request completo al cliente.
  conversation.setAsk((request) => llm.stream(request));

  try {
    while (true) {
      const text = await rl.question("Tú: ");
      const question = text.trim();

      if (!question) {
        continue;
      }

      if (question === "/exit") {
        break;
      }

      if (question === "/clear") {
        conversation.clear();
        continue;
      }

      if (question === "/history") {
        for (const message of conversation.getHistory()) {
          console.log(`${message.role}: ${message.content}`);
        }

        continue;
      }

      if (question === "/stats") {
        console.log(conversation.getStats());
        continue;
      }

      process.stdout.write("\nAsistente: ");

      await conversation.send(question);

      process.stdout.write("\n\n");
    }
  } finally {
    rl.close();
  }
}
```

---

# 📄 11. Revisar archivos con FileReviewer

`FileReviewer` permite leer un archivo y enviarlo al LLM para su análisis.

Además de la respuesta, retorna información útil sobre el archivo procesado.

## Crear el revisor

```ts
import { FileReviewer } from "../files/index.js";
import { config } from "../config/index.js";

const reviewer = new FileReviewer(
  llm,
  "Analiza el archivo e identifica problemas importantes.",
  `
Actúa como revisor de código.

Prioriza:
- errores;
- seguridad;
- mantenibilidad;
- claridad.
`,
  {
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
  },
  {
    maxChars: 40_000,
    rejectUnsupportedExtensions: true,
  },
);
```

---

## Revisar un archivo

```ts
const result = await reviewer.reviewFile(
  "./src/services/user.service.ts",
  "complete",
);

console.log(result.review);
```

Para streaming:

```ts
const result = await reviewer.reviewFile(
  "./src/services/user.service.ts",
  "stream",
);
```

---

## Datos retornados por FileReviewer

El resultado contiene información como:

```ts
result.fileName;
result.filePath;
result.extension;
result.totalLines;
result.totalCharacters;
result.reviewedCharacters;
result.truncated;
result.warnings;
result.review;
result.totalInputTokens;
result.totalOutputTokens;
```

Ejemplo:

```ts
console.log(`Archivo: ${result.fileName}`);
console.log(`Líneas: ${result.totalLines}`);
console.log(`Caracteres: ${result.totalCharacters}`);
console.log(`Caracteres revisados: ${result.reviewedCharacters}`);
console.log(`Truncado: ${result.truncated ? "Sí" : "No"}`);

for (const warning of result.warnings) {
  console.log(`Advertencia: ${warning}`);
}
```

`maxChars` controla la cantidad máxima de caracteres del archivo enviados al modelo.

Cuando el archivo supera ese límite, `FileReviewer` revisa solamente la primera parte e informa la situación mediante `warnings`.

---

# 🧰 12. Uso de Tools

Una tool permite que el modelo solicite la ejecución de una operación disponible en la aplicación.

Ejemplos habituales:

- listar archivos;
- localizar un archivo;
- leer archivos;
- buscar texto;
- consultar servicios;
- obtener datos de una base de datos;
- ejecutar una operación controlada por la aplicación.

Para utilizar una tool se necesitan dos piezas principales:

```text
tool.definitions.ts
        +
tools.executor.ts
```

La primera describe las operaciones disponibles.

La segunda implementa esas operaciones.

---

# 📝 13. Estructura de `tool.definitions.ts`

El archivo de definiciones describe las tools que el modelo puede solicitar.

Una definición contiene principalmente:

```text
name
description
input_schema
```

Ejemplo completo:

```ts
import { ToolDefinition } from "../../types/agent/index.js";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_text_file",

    description: "Lee el contenido completo de un archivo de texto.",

    input_schema: {
      type: "object",

      properties: {
        file_path: {
          type: "string",
          description: "Ruta del archivo que se desea leer.",
        },
      },

      required: ["file_path"],
    },
  },

  {
    name: "list_directory",

    description: "Lista los archivos contenidos en un directorio.",

    input_schema: {
      type: "object",

      properties: {
        path: {
          type: "string",
          description: "Ruta del directorio que se desea listar.",
        },

        extension: {
          type: "string",
          description: "Extensión opcional utilizada para filtrar resultados.",
        },
      },

      required: ["path"],
    },
  },
];
```

---

## 🏷️ `name`

Identifica la tool.

```ts
name: "read_text_file";
```

Debe ser:

- único;
- descriptivo;
- estable;
- igual al nombre utilizado en el executor.

Por ejemplo, si la definición utiliza:

```ts
name: "read_text_file";
```

el executor debe reconocer exactamente:

```ts
case "read_text_file":
```

---

## 📝 `description`

Explica al modelo cuándo debe utilizar la tool.

```ts
description: "Lee el contenido completo de un archivo de texto.";
```

La descripción debe indicar claramente la operación realizada.

Conviene evitar descripciones ambiguas como:

```ts
description: "Trabaja con archivos.";
```

Es mejor:

```ts
description: "Busca recursivamente un archivo por su nombre completo.";
```

---

## 🧩 `input_schema`

Describe los argumentos aceptados.

Ejemplo:

```ts
input_schema: {
  type: "object",

  properties: {
    file_name: {
      type: "string",
      description:
        "Nombre completo del archivo que se desea localizar.",
    },

    path: {
      type: "string",
      description:
        "Directorio desde el cual debe comenzar la búsqueda.",
    },
  },

  required: [
    "file_name",
    "path",
  ],
}
```

### `properties`

Define los parámetros disponibles.

### `required`

Indica cuáles son obligatorios.

Un parámetro puede existir en `properties` sin aparecer en `required`. En ese caso es opcional.

---

# 🔧 14. Estructura de `tools.executor.ts`

La definición de una tool no ejecuta ninguna operación.

La ejecución real se implementa mediante un `ToolExecutionHandler`.

Su contrato es:

```ts
type ToolExecutionHandler = (
  name: string,
  params: Record<string, unknown>,
) => Promise<string>;
```

Esto significa que el executor recibe:

```ts
name;
```

con el nombre de la tool solicitada y:

```ts
params;
```

con los argumentos proporcionados.

El resultado debe ser un `string`.

---

## Ejemplo completo de executor

```ts
import { readFile, readdir } from "node:fs/promises";

import { ToolExecutionHandler } from "../../types/agent/index.js";

/**
 * Ejecuta las tools relacionadas con archivos.
 */
export const executeFileTool: ToolExecutionHandler = async (
  name,
  params,
): Promise<string> => {
  switch (name) {
    case "read_text_file": {
      const filePath = params.file_path;

      if (typeof filePath !== "string") {
        throw new Error("file_path debe ser una cadena.");
      }

      const content = await readFile(filePath, "utf-8");

      return content;
    }

    case "list_directory": {
      const directoryPath = params.path;

      if (typeof directoryPath !== "string") {
        throw new Error("path debe ser una cadena.");
      }

      const entries = await readdir(directoryPath, {
        withFileTypes: true,
      });

      return entries.map((entry) => entry.name).join("\n");
    }

    default:
      throw new Error(`Tool no registrada: ${name}`);
  }
};
```

---

# 🔗 15. Relación entre definición y executor

Si existe esta definición:

```ts
{
  name: "read_text_file",
  description: "...",
  input_schema: {
    // ...
  },
}
```

debe existir una implementación equivalente:

```ts
case "read_text_file": {
  // Ejecutar operación.
}
```

La relación es:

```text
TOOL_DEFINITIONS
      │
      │ describe
      ▼
read_text_file
      │
      │ solicita
      ▼
executeFileTool()
      │
      │ ejecuta
      ▼
contenido del archivo
```

La descripción determina qué conoce el modelo.

El executor determina qué puede hacer realmente la aplicación.

---

# 📦 16. Organización recomendada para tools

Una estructura sencilla es:

```text
tools/
├── definitions/
│   ├── tools.definitions.ts
│   └── index.ts
│
├── executor/
│   ├── files-tools.executor.ts
│   └── index.ts
│
└── index.ts
```

`definitions` contiene los contratos visibles para el modelo.

`executor` contiene las funciones reales que ejecuta la aplicación.

---

# 🤖 17. Crear una conversación con Tools

Para utilizar tools en una conversación se proporcionan:

1. las definiciones;
2. el executor.

Ejemplo:

```ts
import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";
import { TOOL_DEFINITIONS } from "../tools/definitions/index.js";
import { executeFileTool } from "../tools/executor/index.js";

const conversation = new Conversation(
  `
Eres un asistente para explorar un proyecto.

Utiliza las tools disponibles cuando necesites
consultar archivos del proyecto.
`,
  {
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
    maxToolCalls: config.max_tool_calls,
  },
);

conversation.setAsk((request) => llm.ask(request));

const { text } = await conversation.sendChat(
  "Lista los archivos del directorio ./src/types",
  TOOL_DEFINITIONS,
  executeFileTool,
);

console.log(text);
```

El modelo podrá seleccionar una de las tools declaradas en:

```ts
TOOL_DEFINITIONS;
```

y la aplicación ejecutará la operación mediante:

```ts
executeFileTool;
```

---

# 📊 18. Consultar las tools utilizadas

Después de un turno pueden consultarse las estadísticas:

```ts
const stats = conversation.getStats();

console.log(`Llamadas a tools: ${stats.toolCallsLastTurn}`);
```

Por ejemplo, una solicitud como:

```text
Busca la palabra buildFullPath
```

puede ejecutar:

```text
search_file_content
```

y producir:

```ts
stats.toolCallsLastTurn === 1;
```

Una petición que requiera dos operaciones distintas puede producir:

```ts
stats.toolCallsLastTurn === 2;
```

si ambas llamadas están permitidas por la configuración.

---

# 🛑 19. Limitar llamadas a Tools

El límite se configura al crear la conversación:

```ts
const conversation = new Conversation(systemPrompt, {
  maxTokens: config.max_tokens,
  maxTokensTools: config.max_tokens_tools,
  maxIterations: config.max_iterations,
  maxToolCalls: config.max_tool_calls,
});
```

Por ejemplo:

```ts
maxToolCalls: 2;
```

permite como máximo dos llamadas durante un turno.

Esto evita que una solicitud genere una cantidad indefinida de operaciones.

---

# 🖥️ 20. Comandos útiles para un chat con Tools

En una aplicación interactiva pueden implementarse comandos especiales.

Por ejemplo:

```text
/tools
/history
/stats
/clear
/exit
```

### `/tools`

Muestra las tools disponibles.

```ts
for (const tool of TOOL_DEFINITIONS) {
  const params = Object.keys(tool.input_schema.properties);

  console.log(`${tool.name}(${params.join(", ")})`);

  console.log(tool.description);
}
```

### `/history`

Muestra la conversación actual.

```ts
for (const message of conversation.getHistory()) {
  console.log(`${message.role}: ${message.content}`);
}
```

### `/stats`

Muestra estadísticas.

```ts
console.log(conversation.getStats());
```

### `/clear`

Reinicia la conversación.

```ts
conversation.clear();
```

---

# 🔍 21. Uso de RAG

RAG permite responder preguntas utilizando información recuperada de documentos previamente procesados.

El uso se divide en dos operaciones principales:

```text
1. Ingestar documentos
2. Realizar consultas
```

---

# 📥 22. Ingestar documentación

La ingestión se realiza mediante `runIngest()`.

Ejemplo:

```ts
import { config } from "../config/index.js";
import { runIngest } from "../rag/ingest/ingest.js";
import { ChunkingFileExtension } from "../rag/services/index.js";

export async function ingestDocumentation(): Promise<void> {
  await runIngest(
    config.docsPath,
    config.separator,
    config.extention as ChunkingFileExtension,
    config.targetChunkSize,
    config.chunkSizeTolerance,
  );

  console.log("Documentación procesada correctamente.");
}
```

Durante este proceso los documentos son preparados para posteriores búsquedas semánticas.

Una vez completada la ingestión, el sistema puede recuperar fragmentos relevantes para las preguntas del usuario.

---

# 🔎 23. Realizar una consulta RAG

`RagPromptService` permite construir el prompt enriquecido con información recuperada.

Ejemplo:

```ts
import { config } from "../config/index.js";
import { RAG_INSTRUCTIONS, RAG_SYSTEM_PROMPT } from "../llm/prompts/index.js";
import { RagPromptService } from "../rag/services/index.js";

export async function askDocumentation(llm: LlmClient): Promise<void> {
  const question = "¿Cuáles son los pasos para ejecutar el proyecto?";

  const ragService = new RagPromptService();

  // Recupera información relevante y construye
  // el prompt que será enviado al modelo.
  const ragPrompt = await ragService.buildRagPrompt(question, RAG_INSTRUCTIONS);

  const response = await llm.ask({
    prompt: ragPrompt,
    systemPrompt: RAG_SYSTEM_PROMPT,
    maxTokens: config.max_tokens,
    maxTokensTools: config.max_tokens_tools,
    maxIterations: config.max_iterations,
  });

  console.log(response.text);
}
```

La pregunta original se utiliza para encontrar fragmentos relacionados.

El prompt generado puede incluir:

```text
Contexto recuperado de la documentación
+
instrucciones RAG
+
pregunta del usuario
```

El modelo utiliza ese contexto para producir la respuesta.

---

# 📚 24. RAG dentro de una conversación

Cuando RAG se utiliza dentro de un chat conviene distinguir entre:

```text
Pregunta del usuario
```

y:

```text
Prompt enriquecido utilizado para consultar al modelo
```

El historial visible debería representar una conversación natural:

```text
Usuario:
¿Cuál es la Base URL?

Asistente:
La Base URL es https://...
```

Los fragmentos recuperados son contexto de consulta y normalmente no necesitan mostrarse como si fueran parte del mensaje escrito por el usuario.

Esto también facilita que `/history` siga siendo legible.

---

# ✍️ 25. Organización de Prompts

Los prompts reutilizables pueden almacenarse como constantes.

Ejemplo:

```ts
export const DOCUMENTATION_ASSISTANT_PROMPT = `
Eres un asistente especializado en documentación técnica.

Responde de forma clara y precisa.

Cuando no tengas suficiente información,
indícalo explícitamente.
`;
```

Después pueden utilizarse desde cualquier componente:

```ts
const conversation = new Conversation(DOCUMENTATION_ASSISTANT_PROMPT, options);
```

o:

```ts
const response = await llm.ask({
  prompt: question,
  systemPrompt: DOCUMENTATION_ASSISTANT_PROMPT,
  maxTokens: config.max_tokens,
  maxTokensTools: config.max_tokens_tools,
  maxIterations: config.max_iterations,
});
```

Esto evita duplicar prompts extensos entre diferentes ejemplos o componentes.

---

# 📈 26. Consumo de Tokens

Las respuestas del LLM incluyen:

```ts
totalInputTokens;
totalOutputTokens;
```

Ejemplo:

```ts
const response = await llm.ask({
  prompt: "Explica qué es REST.",
  maxTokens: config.max_tokens,
  maxTokensTools: config.max_tokens_tools,
  maxIterations: config.max_iterations,
});

console.log(`Entrada: ${response.totalInputTokens}`);

console.log(`Salida: ${response.totalOutputTokens}`);
```

En conversaciones, los valores se acumulan:

```ts
const stats = conversation.getStats();

console.log(stats.inputTokens);
console.log(stats.outputTokens);
```

El consumo de entrada puede aumentar conforme crece el historial de la conversación.

También puede aumentar cuando se utilizan tools que retornan contenido extenso, como la lectura completa de archivos.

---

# 🧪 27. Ejemplo completo: asistente con Tools

El siguiente ejemplo reúne los componentes principales necesarios para construir un pequeño asistente de archivos.

```ts
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { Conversation } from "../chat/index.js";
import { config } from "../config/index.js";
import { TOOL_DEFINITIONS } from "../tools/definitions/index.js";
import { executeFileTool } from "../tools/executor/index.js";
import { LlmClient } from "../types/app/index.js";

export async function runFileAssistant(llm: LlmClient): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
  });

  const conversation = new Conversation(
    `
Eres un asistente para consultar archivos de un proyecto.

Utiliza las herramientas disponibles solamente
cuando la petición requiera acceder al sistema de archivos.
`,
    {
      maxTokens: config.max_tokens,
      maxTokensTools: config.max_tokens_tools,
      maxIterations: config.max_iterations,
      maxToolCalls: config.max_tool_calls,
    },
  );

  conversation.setAsk((request) => llm.ask(request));

  console.log("Asistente de archivos");
  console.log("Comandos: /tools, /history, /stats, /clear, /exit");

  try {
    while (true) {
      const rawInput = await rl.question("\nTú: ");
      const question = rawInput.trim();

      if (!question) {
        continue;
      }

      if (question === "/exit") {
        break;
      }

      if (question === "/clear") {
        conversation.clear();
        console.log("Conversación reiniciada.");
        continue;
      }

      if (question === "/history") {
        const history = conversation.getHistory();

        if (history.length === 0) {
          console.log("No existe historial.");
          continue;
        }

        for (const message of history) {
          console.log("");
          console.log(`${message.role}:`);
          console.log(message.content);
        }

        continue;
      }

      if (question === "/stats") {
        const stats = conversation.getStats();

        console.log(`Turnos: ${stats.turns}`);

        console.log(`Tokens entrada: ${stats.inputTokens}`);

        console.log(`Tokens salida: ${stats.outputTokens}`);

        console.log(`Tools último turno: ${stats.toolCallsLastTurn}`);

        continue;
      }

      if (question === "/tools") {
        console.log("Tools disponibles:");

        for (const tool of TOOL_DEFINITIONS) {
          console.log(`- ${tool.name}: ${tool.description}`);
        }

        continue;
      }

      try {
        const { text } = await conversation.sendChat(
          question,
          TOOL_DEFINITIONS,
          executeFileTool,
        );

        console.log("");
        console.log(`Asistente: ${text}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";

        console.error(`Error: ${message}`);
      }
    }
  } finally {
    rl.close();
  }
}
```

---

# 🗂️ 28. Componentes y casos de uso

| Componente                  | Uso principal                                      |
| --------------------------- | -------------------------------------------------- |
| `LlmClient.ask()`           | Obtener una respuesta completa                     |
| `LlmClient.stream()`        | Obtener una respuesta progresiva                   |
| `Conversation`              | Mantener un chat con múltiples turnos              |
| `Conversation.getHistory()` | Consultar el historial                             |
| `Conversation.getStats()`   | Consultar estadísticas                             |
| `Conversation.clear()`      | Reiniciar una conversación                         |
| `FileReviewer`              | Analizar archivos mediante un LLM                  |
| `ToolDefinition`            | Describir una operación disponible para el modelo  |
| `ToolExecutionHandler`      | Implementar la ejecución real de una tool          |
| `RagPromptService`          | Construir consultas enriquecidas con documentación |
| `runIngest()`               | Preparar documentación para RAG                    |

---

# ✅ 29. Recomendaciones de uso

Mantén las definiciones de tools separadas de su implementación:

```text
definitions
executor
```

Utiliza nombres de tools claros y estables:

```text
list_files
find_file
read_file
search_file_content
```

Describe con precisión sus argumentos:

```ts
required: ["file_name", "path"];
```

Valida siempre los parámetros recibidos por el executor:

```ts
if (typeof filePath !== "string") {
  throw new Error("file_path debe ser una cadena.");
}
```

Devuelve desde las tools contenido textual que el modelo pueda interpretar:

```ts
return content;
```

Utiliza `Conversation` cuando necesites múltiples turnos.

Utiliza llamadas directas a:

```ts
llm.ask();
```

o:

```ts
llm.stream();
```

cuando la solicitud sea independiente y no necesite conservar historial.

Utiliza `FileReviewer` para enviar archivos completos o parciales al modelo.

Ejecuta la ingestión antes de realizar consultas RAG sobre documentación nueva o modificada.

Consulta:

```ts
conversation.getStats();
```

para controlar el consumo de tokens y la cantidad de llamadas a tools.

Utiliza:

```ts
conversation.getHistory();
```

cuando necesites mostrar, guardar o inspeccionar la conversación actual.
