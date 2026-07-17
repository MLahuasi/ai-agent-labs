# 🚀 Creación del Proyecto

Inicializar el proyecto Node.js con el siguiente comando:

```powershell
# Crear package.json
npm init -y
```

---

# 📦 Dependencias

Configuración inicial del proyecto y las librerías necesarias para trabajar con modelos de IA, embeddings y funcionalidades RAG.

```json
{
  "name": "dev-assistant",
  "version": "0.1.0",
  "description": "Asistente inteligente de documentación técnica con RAG, function Calling y claude API",
  "main": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "tsx src/index.ts",
    "review": "tsx src/exercises/code-reviewer.ts",
    "ingest": "tsx src/rag/ingest.ts",
    "demo": "tsx src/agent/demo.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["ai", "claude", "openai", "rag", "function-calling"],
  "author": "DevAssistant Curso IA",
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.111.0",
    "dotenv": "^17.3.1",
    "openai": "^6.32.0",
    "readline": "^1.3.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  },
  "devDependencies": {
    "@types/node": "^25.5.0"
  }
}
```

Instalar dependencias:

```powershell
npm install
```

---

# ⚙️ Configuración de TypeScript

El proyecto utiliza TypeScript con una configuración estricta para mejorar la calidad del código y detectar errores durante el desarrollo.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ESNext"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Crear el archivo `tsconfig.json` en la raíz del proyecto con esta configuración.

---

# 📁 Estructura del Proyecto

La siguiente estructura organiza el código por responsabilidades para facilitar la comprensión y evolución del laboratorio.

```text
.
├── docs/                     # Documentación utilizada por RAG
├── issues/                   # Registro de errores e incidencias
├── src/
│   ├── config/               # Configuración de la aplicación
│   │   └── index.ts
│   │
│   ├── llm/                  # Integración con proveedores de IA
│   │   ├── clients/
│   │   │   ├── anthropic.client.ts
│   │   │   ├── gemini.client.ts
│   │   │   ├── groq.client.ts
│   │   │   ├── ollama.client.ts
│   │   │   ├── openai.client.ts
│   │   │   └── index.ts
│   │   │
│   │   └── prompts/
│   │       ├── system.prompt.ts
│   │       └── index.ts
│   │
│   └── types/                # Tipos compartidos del proyecto
│       ├── agent.types.ts
│       ├── chat.types.ts
│       ├── config.types.ts
│       ├── rag.types.ts
│       ├── tools.types.ts
│       └── index.ts
│
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.json

```

---

## 🔐 Variables de Entorno

El proyecto requiere claves de acceso para consumir APIs de modelos de lenguaje.

> ⚠️ Nunca subir archivos `.env` al repositorio.
>
> Agrega `.env` al archivo `.gitignore`.

Crea un archivo `.env` en la raíz del proyecto:

```env
# DevAssistant - Variables de entorno
# Copia este archivo como .env y agrega tus API keys reales
# NUNCA commitees el archivo .env

# === API Keys ===
# Obtén tu key en: https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Obtén tu key en: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# === Configuración del modelo ===
# Opciones: anthropic | openai
MODEL_PROVIDER=anthropic

# Modelo de Anthropic a usar (opciones: claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-6)
ANTHROPIC_MODEL=claude-sonnet-4-6

# Modelo de OpenAI a usar (opciones: gpt-4o-mini, gpt-4o)
OPENAI_MODEL=gpt-4o-mini

# Modelo de embeddings de OpenAI
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# === RAG ===
# Directorio donde está la documentación a indexar
DOCS_PATH=./docs/sample-project

# Ruta a la base de datos de vectores
DB_PATH=./data/vectors.db

# Número de chunks a recuperar por búsqueda
RAG_TOP_K=5

# Numero Maximo de Tokens
MAX_TOKENS= 1024
```

---

### RELACIONADOS

[INSTALAR AMBIENTE PYTHON](./install-python-windows.md)
**NOTA**: No se usa en este proyecto

---

[REGRESAR](../../README.md)
