# Patrones de Diseño Agéntico

## Aprendiendo sobre patrones de diseño para agentes

Este es el repositorio del proyecto para aprender sobre patrones de diseño para agentes.

### Tecnologías

- TypeScript
- Node.js
- [AI SDK](https://www.npmjs.com/package/ai)
- [Zod](https://www.npmjs.com/package/zod)

### Crear Proyecto

```bash
npm init -y

npm pkg set name="agentic-patterns"
npm pkg set version="1.0.0"
npm pkg set description="Un proyecto aprender sobre patrones de diseño para agentes"
npm pkg set main="dist/main.js"
npm pkg set type="module"
npm pkg set license="ISC"

npm pkg set scripts.build="tsc"
npm pkg set scripts.start="node --env-file=.env dist/main.js"
npm pkg set scripts.dev="tsx --env-file=.env src/main.ts"
npm pkg set scripts.watch="tsx watch --env-file=.env src/main.ts"

mkdir src

npx tsc --init
```

#### Instalar [ai-sdk.dev](https://ai-sdk.dev/docs/introduction)

AI SDK es un conjunto de herramientas para JavaScript y TypeScript que facilita la integración de modelos de inteligencia artificial de distintos proveedores, como OpenAI, Anthropic, Google o Groq, mediante una interfaz común.

Permite trabajar con generación de texto, streaming, herramientas, salidas estructuradas, embeddings y flujos de varios pasos sin acoplar la aplicación directamente a un proveedor específico.

En proyectos de agentes de IA resulta especialmente útil porque reduce el código de infraestructura y permite concentrarse en la lógica agéntica, como Tool Use, Planning, Reflection, Routing y coordinación entre agentes.

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/groq ollama-ai-provider-v2 zod

npm install -D typescript tsx @types/node
```

#### Instalar [Skills](https://ai-sdk.dev/docs/getting-started/coding-agents)

## AI SDK Skill

AI SDK ofrece una **Skill para agentes de programación** que proporciona instrucciones especializadas sobre cómo utilizar el SDK correctamente dentro del proyecto.

Se instala con:

```bash
npx skills add vercel/ai
```

La skill ayuda a que herramientas como **Codex, OpenCode, Claude Code o Cursor** comprendan mejor las APIs, patrones y buenas prácticas de AI SDK sin depender únicamente del contexto proporcionado manualmente.

```text
Coding Agents + AI SDK
        │
        ├── Skills
        │   └── conocimiento especializado para el agente
        │
        ├── node_modules/ai/docs
        │   └── documentación de la versión instalada
        │
        └── DevTools
            └── inspección y depuración de llamadas al LLM
```

### Levantar proyecto

1. Clonar el `.env.template` y renombrarlo a `.env`
2. Llenar las variables de entorno
3. Instalar las dependencias `npm install`
4. Ejecutar el proyecto `npm run dev`
5. Cambiar el `main.ts` para ejecutar el patrón que se desee

## Actualizar dependencias (Opcional)

Para actualizar todas las dependencias a las últimas versiones permitidas por package.json, ejecuta:

```bash
npm update
```

Si quieres actualizar una dependencia específica a la última versión (mayor, menor, o patch), usa:

```bash
npm install nombre-del-paquete@latest
```

Para revisar si hay actualizaciones disponibles y ver sugerencias:

```bash
npm outdated
```

**Nota:** Si quieres actualizar todas las dependencias a la última versión disponible (rompiendo potencialmente cambios mayores), puedes usar herramientas como [`npm-check-updates`](https://www.npmjs.com/package/npm-check-updates):

```bash
npx npm-check-updates -u
npm install
```

Esto modificará tu `package.json` con las versiones más recientes.
