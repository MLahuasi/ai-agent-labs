# 📎 Anexo: Chunking en PDF, Excel, Word y TXT

El **chunking** debe adaptarse a la estructura de cada formato. Un PDF no se procesa igual que una hoja de Excel, y un archivo Word conserva más estructura semántica que un archivo TXT.

```text
Archivo
   │
   ▼
Extracción del contenido
   │
   ▼
Normalización
   │
   ▼
División en unidades lógicas
   │
   ▼
Chunks con metadatos
   │
   ▼
Embeddings
```

Las herramientas incluidas en este anexo son **open source, gratuitas y ejecutables localmente**.

> El software puede no tener costo de licencia, pero su ejecución consume recursos de infraestructura y requiere desarrollo, configuración y mantenimiento.

---

# 📄 Chunking de archivos PDF

Un PDF puede contener:

- Texto seleccionable.
- Varias columnas.
- Encabezados y pies de página.
- Tablas.
- Imágenes.
- Diagramas.
- Fórmulas.
- Páginas escaneadas.

El reto principal consiste en reconstruir correctamente el orden del contenido antes de dividirlo.

## Flujo recomendado

```text
PDF
 │
 ▼
Extraer texto, tablas e imágenes
 │
 ▼
Aplicar OCR cuando sea necesario
 │
 ▼
Eliminar encabezados y pies repetidos
 │
 ▼
Detectar títulos, secciones y párrafos
 │
 ▼
Dividir las secciones demasiado grandes
 │
 ▼
Conservar páginas y títulos como metadatos
```

## Estrategia de chunking

1. Dividir por títulos o secciones cuando puedan identificarse.
2. Mantener juntos los párrafos relacionados.
3. Subdividir las secciones que superen el tamaño máximo.
4. Aplicar un overlap moderado cuando una explicación continúe entre fragmentos.
5. Conservar el número de página como metadato.

```ts
interface PdfChunkMetadata {
  fileName: string;
  pageStart: number;
  pageEnd: number;
  heading?: string;
}
```

## Imágenes dentro del PDF

```text
Imagen decorativa
└── Ignorar

Imagen con texto
└── Aplicar OCR

Tabla convertida en imagen
└── OCR y reconstrucción de filas y columnas

Diagrama o gráfico
└── Extraer y procesar mediante un modelo visual local
```

El OCR puede recuperar palabras, pero no siempre conserva correctamente:

- Flechas.
- Relaciones entre elementos.
- Colores.
- Agrupaciones.
- Valores representados gráficamente.

---

# 📊 Chunking de archivos Excel

En Excel, los chunks deben construirse a partir de:

- Hojas.
- Tablas.
- Encabezados.
- Grupos de filas.
- Categorías.
- Rangos de fechas.
- Entidades del negocio.

No suele ser recomendable convertir todo el libro en un único texto y dividirlo por caracteres.

## Flujo recomendado

```text
Excel
  │
  ▼
Leer las hojas
  │
  ▼
Detectar tablas y encabezados
  │
  ▼
Normalizar celdas combinadas y vacías
  │
  ▼
Agrupar filas relacionadas
  │
  ▼
Repetir encabezados en cada chunk
  │
  ▼
Conservar hoja y rango de filas
```

## Estrategias de chunking

### Por grupos de filas

```text
Chunk 1: filas 2–25
Chunk 2: filas 26–49
Chunk 3: filas 50–73
```

### Por categoría

```text
Ventas
├── Chunk: Cliente ACME
├── Chunk: Cliente Nova
└── Chunk: Cliente Contoso
```

### Por periodo

```text
Transacciones
├── Chunk: Enero
├── Chunk: Febrero
└── Chunk: Marzo
```

Cada chunk debe repetir los encabezados:

```text
Hoja: Pedidos
Columnas: Pedido | Cliente | Estado | Total

1001 | ACME | Entregado | 1200
1002 | ACME | Pendiente | 300
```

## Fórmulas

Una librería puede leer una fórmula:

```text
=SUM(D2:D20)
```

y, dependiendo del archivo, su último valor calculado:

```text
12500
```

Sin embargo, estas herramientas normalmente no ejecutan Excel para recalcular fórmulas.

El valor almacenado puede estar desactualizado si el archivo depende de:

- Macros.
- Conexiones externas.
- Consultas.
- Complementos.
- Funciones no compatibles.

## Macros

Los archivos `.xlsm` y `.xltm` pueden contener código VBA.

Durante la ingesta:

- No deben ejecutarse las macros.
- El archivo debe procesarse en modo de solo lectura.
- No debe sobrescribirse el original.
- Debe registrarse que contiene VBA.
- Los valores dependientes de una macro pueden estar vacíos o desactualizados.

```text
Archivo con macros
       │
       ▼
Lectura estática
       │
       ├── Extraer celdas
       ├── Extraer valores almacenados
       ├── Detectar contenido VBA
       └── No ejecutar macros
```

## Imágenes dentro de Excel

```text
Logotipo o imagen decorativa
└── Ignorar

Captura con texto
└── Extraer y aplicar OCR

Gráfico convertido en imagen
└── Extraer y procesar por separado

Imagen asociada a una fila
└── Conservar su posición como metadato
```

---

# 📝 Chunking de archivos Word

Los documentos Word suelen conservar una estructura semántica más clara que los PDF:

- Títulos.
- Subtítulos.
- Párrafos.
- Listas.
- Tablas.
- Imágenes.
- Encabezados.
- Pies de página.
- Saltos de sección.

## Flujo recomendado

```text
Word
 │
 ▼
Extraer títulos, párrafos y tablas
 │
 ▼
Eliminar encabezados y pies repetidos
 │
 ▼
Agrupar contenido por sección
 │
 ▼
Dividir secciones demasiado grandes
 │
 ▼
Conservar títulos como metadatos
```

## Estrategia de chunking

1. Utilizar los estilos `Heading 1`, `Heading 2` y `Heading 3`.
2. Agrupar los párrafos bajo su título correspondiente.
3. Mantener las listas junto con el contenido que las introduce.
4. Procesar las tablas como unidades independientes.
5. Dividir únicamente las secciones demasiado grandes.

```text
Heading 1: Autenticación
├── Párrafo introductorio
├── Heading 2: JWT
│   ├── Párrafo
│   └── Lista
└── Heading 2: Sesiones
    └── Párrafo
```

## Imágenes dentro de Word

Las imágenes pueden:

- Ignorarse cuando son decorativas.
- Extraerse cuando contienen información.
- Procesarse mediante OCR si contienen texto.
- Describirse con un modelo visual local si son diagramas o gráficos.

También puede utilizarse el texto alternativo de la imagen, aunque no debe asumirse que siempre existe o que es correcto.

---

# 📃 Chunking de archivos TXT

Un archivo TXT contiene texto plano y normalmente no conserva estilos, tablas ni jerarquías.

## Flujo recomendado

```text
TXT
 │
 ▼
Detectar codificación
 │
 ▼
Normalizar saltos de línea
 │
 ▼
Separar por bloques o párrafos
 │
 ▼
Agrupar hasta un tamaño máximo
 │
 ▼
Aplicar overlap moderado
```

## Estrategias de chunking

### Por párrafos

```text
Párrafo 1
Párrafo 2
Párrafo 3
```

### Por separadores

```text
========
CAPÍTULO 1
========
```

### Por tamaño

```text
Chunk size: 1000 caracteres
Overlap: 150 caracteres
```

Para TXT normalmente basta con utilizar `node:fs` y un splitter sencillo.

---

# 🧰 Herramientas disponibles

Las herramientas de extracción y las herramientas de chunking cumplen responsabilidades diferentes:

```text
Parser
└── Lee e interpreta el formato

Chunker
└── Divide el contenido extraído
```

## Cuadro consolidado

| Herramienta                   | Requisito                         |                PDF |              Excel |               Word | TXT | Extrae contenido | Genera chunks | Costo                              |
| ----------------------------- | --------------------------------- | -----------------: | -----------------: | -----------------: | --: | ---------------: | ------------: | ---------------------------------- |
| **Docling**                   | Python, `pip` o `uv`              |                 ✅ |                 ✅ |                 ✅ |  ✅ |               ✅ |            ✅ | Gratuito                           |
| **Unstructured Open Source**  | Python y dependencias del sistema |                 ✅ |                 ✅ |                 ✅ |  ✅ |               ✅ |            ✅ | Gratuito                           |
| **Apache Tika**               | Java o Docker                     |                 ✅ |                 ✅ |                 ✅ |  ✅ |               ✅ |            ❌ | Gratuito                           |
| **LangChain.js**              | Node.js 20+, npm, pnpm o yarn     |    Mediante loader |    Mediante loader |    Mediante loader |  ✅ |          Parcial |            ✅ | Gratuito                           |
| **pdfjs-dist**                | Node.js y npm                     |                 ✅ |                 ❌ |                 ❌ |  ❌ |               ✅ |            ❌ | Gratuito                           |
| **pdfplumber**                | Python y `pip`                    |                 ✅ |                 ❌ |                 ❌ |  ❌ |               ✅ |            ❌ | Gratuito                           |
| **ExcelJS**                   | Node.js y npm                     |                 ❌ |                 ✅ |                 ❌ |  ❌ |               ✅ |            ❌ | Gratuito                           |
| **SheetJS Community Edition** | Node.js y npm                     |                 ❌ |                 ✅ |                 ❌ |  ❌ |               ✅ |            ❌ | Gratuito en su edición comunitaria |
| **openpyxl**                  | Python y `pip`                    |                 ❌ |                 ✅ |                 ❌ |  ❌ |               ✅ |            ❌ | Gratuito                           |
| **Mammoth.js**                | Node.js y npm                     |                 ❌ |                 ❌ |                 ✅ |  ❌ |               ✅ |            ❌ | Gratuito                           |
| **python-docx**               | Python y `pip`                    |                 ❌ |                 ❌ |                 ✅ |  ❌ |               ✅ |            ❌ | Gratuito                           |
| **Node.js `fs`**              | Node.js                           |                 ❌ |                 ❌ |                 ❌ |  ✅ |               ✅ |            ❌ | Incluido en Node.js                |
| **@langchain/textsplitters**  | Node.js 20+ y npm                 | Contenido extraído | Contenido extraído | Contenido extraído |  ✅ |               ❌ |            ✅ | Gratuito                           |

## Consideraciones

- **Docling** ofrece una solución completa, pero requiere Python y consume más recursos.
- **Unstructured** admite muchos formatos, aunque su instalación puede ser pesada.
- **Apache Tika** es útil para extracción genérica, pero no genera chunks semánticos.
- **LangChain.js** facilita el chunking y la integración con embeddings, pero no reemplaza completamente al parser de cada formato.
- **pdfjs-dist**, **ExcelJS** y **Mammoth.js** permiten mantener el pipeline en Node.js.
- Para Excel conviene implementar un chunker específico basado en filas, encabezados y categorías.
- Para PDF, Word y TXT puede utilizarse un splitter narrativo como `RecursiveCharacterTextSplitter`.

LangChain recomienda `RecursiveCharacterTextSplitter` como punto de partida para texto genérico. Este splitter intenta preservar primero párrafos, después líneas, palabras y finalmente caracteres hasta alcanzar el tamaño configurado. :contentReference[oaicite:0]{index=0}

---

# 🦜 Ejemplo sencillo con LangChain.js

LangChain.js puede dividir un texto ya extraído mediante `RecursiveCharacterTextSplitter`.

## Instalación

```bash
npm install @langchain/textsplitters @langchain/core
```

Las versiones actuales de LangChain.js requieren Node.js 20 o superior. :contentReference[oaicite:1]{index=1}

## Archivo de ejemplo

```text
documents/manual.txt
```

Contenido:

```text
NestJS es un framework para construir aplicaciones del lado del servidor.

Los módulos permiten organizar las funcionalidades de la aplicación.

Los controladores reciben solicitudes HTTP y delegan la lógica en los servicios.

Los servicios contienen la lógica de negocio y pueden utilizar repositorios.
```

## Código

```ts
import { readFile } from "node:fs/promises";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/** Lee un archivo TXT y lo divide en chunks. */
async function createChunks(filePath: string) {
  const content = await readFile(filePath, "utf-8");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 120,
    chunkOverlap: 20,
  });

  return await splitter.createDocuments(
    [content],
    [
      {
        fileName: filePath,
        format: "txt",
      },
    ],
  );
}

const chunks = await createChunks("./documents/manual.txt");

for (const [index, chunk] of chunks.entries()) {
  console.log({
    index,
    content: chunk.pageContent,
    metadata: chunk.metadata,
  });
}
```

`createDocuments()` devuelve objetos `Document` que contienen el texto en `pageContent` y los metadatos en `metadata`. :contentReference[oaicite:2]{index=2}

## Resultado aproximado

```text
Chunk 0
NestJS es un framework para construir aplicaciones del lado del servidor.

Los módulos permiten organizar...

Chunk 1
permiten organizar las funcionalidades de la aplicación.

Los controladores reciben solicitudes HTTP...

Chunk 2
reciben solicitudes HTTP y delegan la lógica en los servicios.

Los servicios contienen la lógica...
```

El contenido repetido entre chunks corresponde al `chunkOverlap`.

```text
Chunk 1
───────────────
...organizar las funcionalidades...

Chunk 2
───────────────
...las funcionalidades...
```

## Configuración

```ts
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
});
```

| Propiedad      | Descripción                                                       |
| -------------- | ----------------------------------------------------------------- |
| `chunkSize`    | Tamaño máximo aproximado de cada chunk                            |
| `chunkOverlap` | Cantidad de contenido repetido entre chunks                       |
| `separators`   | Separadores que se intentan utilizar para conservar la estructura |

El splitter recursivo mide el tamaño por caracteres y utiliza por defecto separadores equivalentes a párrafos, líneas, espacios y caracteres individuales. :contentReference[oaicite:3]{index=3}

## Separadores personalizados

Para documentos Markdown o textos con títulos, pueden definirse separadores específicos:

```ts
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
  separators: ["\n## ", "\n### ", "\n\n", "\n", " ", ""],
});
```

Esto indica que primero debe intentar dividir por:

1. Títulos de nivel 2.
2. Títulos de nivel 3.
3. Párrafos.
4. Líneas.
5. Palabras.
6. Caracteres.

---

# 📄 Ejemplo con texto extraído de un PDF

LangChain.js también puede dividir documentos obtenidos mediante un loader.

```ts
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const loader = new PDFLoader("./documents/manual.pdf");

const documents = await loader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
});

const chunks = await splitter.splitDocuments(documents);

for (const chunk of chunks) {
  console.log({
    content: chunk.pageContent,
    metadata: chunk.metadata,
  });
}
```

Los loaders de LangChain implementan una interfaz común para cargar documentos y convertirlos a objetos `Document`. LangChain.js dispone de loaders para PDF, DOCX, texto y otros orígenes, aunque algunos requieren paquetes o parsers adicionales. :contentReference[oaicite:4]{index=4}

Instalación típica:

```bash
npm install @langchain/community @langchain/core @langchain/textsplitters pdf-parse
```

## Flujo

```text
manual.pdf
    │
    ▼
PDFLoader
    │
    ▼
Document[]
    │
    ▼
RecursiveCharacterTextSplitter
    │
    ▼
Chunks
```

---

# ⚠️ Consideración para Excel

No conviene aplicar directamente `RecursiveCharacterTextSplitter` sobre todo el Excel convertido a texto.

```text
Excel completo convertido a texto
              │
              ▼
RecursiveCharacterTextSplitter
              │
              └── Puede mezclar hojas, tablas y registros
```

Para Excel es preferible:

```text
ExcelJS
   │
   ▼
Leer hojas y encabezados
   │
   ▼
Agrupar filas relacionadas
   │
   ▼
Crear un chunk por grupo
```

Ejemplo conceptual:

```ts
interface ExcelChunk {
  content: string;
  metadata: {
    fileName: string;
    sheetName: string;
    rowStart: number;
    rowEnd: number;
  };
}
```

LangChain puede utilizarse después para representar esos chunks como documentos, pero la división por filas debería realizarse mediante lógica específica del archivo.

---

# 💰 Costos

Las herramientas descritas pueden utilizarse sin pagar licencias ni solicitudes por archivo.

| Costo               | Descripción                                             |
| ------------------- | ------------------------------------------------------- |
| **Licencia**        | Generalmente USD 0 para las alternativas indicadas      |
| **Infraestructura** | CPU, memoria, disco y, en algunos casos, GPU            |
| **Desarrollo**      | Implementación de parsers, chunkers y manejo de errores |
| **Mantenimiento**   | Actualización de dependencias y compatibilidad          |
| **Procesamiento**   | OCR y análisis visual consumen más recursos             |
| **Almacenamiento**  | Archivos originales, chunks, imágenes y embeddings      |
| **Seguridad**       | Contenedores, validaciones, antivirus y aislamiento     |

```text
Costo de licencia
└── USD 0

Costo operativo
├── Infraestructura
├── Desarrollo
├── Mantenimiento
└── Seguridad
```

---

# 🔐 Recomendaciones de seguridad

Los archivos deben tratarse siempre como contenido no confiable.

- Validar el tipo MIME y no depender solamente de la extensión.
- Limitar el tamaño máximo del archivo.
- Procesar los archivos en un contenedor aislado.
- Ejecutar las herramientas con un usuario sin privilegios.
- Bloquear la red saliente cuando no sea necesaria.
- Establecer límites de CPU, memoria y tiempo.
- No ejecutar macros, scripts ni objetos embebidos.
- No sobrescribir los archivos originales.
- Eliminar archivos temporales.
- Mantener las dependencias actualizadas.
- Rechazar archivos cifrados si no existe una política para procesarlos.
- Registrar el contenido que no pudo extraerse.

---

# 🏗️ Arquitectura recomendada para Node.js

```text
Archivos
   │
   ▼
Validación y aislamiento
   │
   ▼
Selector de parser
   │
   ├── PDF   → pdfjs-dist o PDFLoader
   ├── Excel → ExcelJS
   ├── Word  → Mammoth.js o DOCXLoader
   └── TXT   → node:fs o TextLoader
   │
   ▼
Contenido normalizado
   │
   ▼
Chunker
   │
   ├── Texto narrativo → @langchain/textsplitters
   └── Excel → Chunker propio por filas
   │
   ▼
Chunks con metadatos
   │
   ▼
EmbeddingClient
   │
   ▼
Base de datos vectorial
```

> LangChain.js es útil para dividir y organizar contenido ya extraído, pero la estrategia de chunking debe seguir respetando la estructura natural de cada formato.

[REGRESAR](./chunking.md)
