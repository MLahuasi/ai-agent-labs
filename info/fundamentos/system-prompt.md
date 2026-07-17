# System Prompts

## 🤖 ¿Qué es un System Prompt?

Un **System Prompt** es una instrucción de alto nivel que se envía al modelo antes de la consulta del usuario. Su objetivo es definir el comportamiento esperado de la IA, incluyendo:

- 🎯 Su rol o especialidad (por ejemplo, _Senior Developer especializado en Code Reviews_).
- 📝 El formato que debe seguir en sus respuestas.
- ✅ Los criterios que debe evaluar o priorizar.
- 🌎 El idioma en el que debe responder.
- 📏 Restricciones de longitud, estilo y nivel de detalle.

En otras palabras, el System Prompt funciona como una guía permanente para cada interacción. Aunque el usuario haga la misma pregunta, la respuesta puede variar significativamente dependiendo de las instrucciones definidas en el System Prompt.

---

## 🔍 Objetivo de esta prueba

Esta comparación busca mostrar cómo un mismo modelo responde ante la misma consulta:

### ⚪ Sin System Prompt

- El modelo responde utilizando únicamente su conocimiento general.
- Decide libremente el formato, nivel de detalle y estructura de la respuesta.
- Puede generar respuestas más extensas o inconsistentes entre ejecuciones.

### 🟢 Con System Prompt

- El modelo sigue reglas predefinidas.
- Mantiene una estructura consistente.
- Prioriza los aspectos indicados en las instrucciones.
- Puede reducir significativamente la longitud de la respuesta.
- Produce resultados más alineados con las necesidades de la aplicación.

---

## 📊 Resultado esperado

Al comparar ambas respuestas es posible observar diferencias en:

- 📐 Estructura y organización.
- ✂️ Cantidad de texto generado.
- 🎯 Nivel de enfoque sobre los problemas relevantes.
- 🔒 Énfasis en seguridad y buenas prácticas.
- ⚡ Consumo potencial de tokens.

La siguiente sección muestra ambas ejecuciones utilizando exactamente el mismo código como entrada.

---

## Laboratorio

**Pregunta**:

Revisa este código:

```javascript
async function getUser(id) {
  const query = "SELECT * FROM users WHERE id = " + id;
  const result = await db.query(query);
  return result[0];
}

function calcularDescuento(precio, tipo) {
  if (tipo == "vip") {
    return precio * 0.8;
  } else if (tipo == "regular") {
    return precio * 0.9;
  } else {
    return precio;
  }
}
```

### ✅ Demo 1

Enviando código SIN system prompt

---

## Respuesta:

## Revisión de Código

### 🚨 Problemas Críticos

#### 1. Inyección SQL (`getUser`)

```javascript
// ❌ PELIGROSO - Vulnerable a SQL Injection
const query = "SELECT * FROM users WHERE id = " + id;

// ✅ CORRECTO - Usar consultas parametrizadas
async function getUser(id) {
  const query = "SELECT * FROM users WHERE id = ?";
  const result = await db.query(query, [id]);
  return result[0] ?? null;
}
```

> Un atacante podría pasar `id = "1 OR 1=1"` y obtener **todos los usuarios**.

---

### ⚠️ Problemas Menores

#### 2. Comparación débil (`calcularDescuento`)

```javascript
// ❌ Usa == (comparación débil, ignora tipo de dato)
if (tipo == "vip")

// ✅ Usar === (comparación estricta)
if (tipo === "vip")
```

#### 3. Magic numbers poco descriptivos

```javascript
// ❌ ¿Qué significa 0.8?
return precio * 0.8;

// ✅ Nombrar las constantes
const DESCUENTOS = {
  vip: 0.2, // 20% de descuento
  regular: 0.1, // 10% de descuento
};
```

---

### ✅ Código Refactorizado

```javascript
const DESCUENTOS = {
  vip: 0.2,
  regular: 0.1,
};

async function getUser(id) {
  if (!id) throw new Error("ID inválido");

  const result = await db.query("SELECT * FROM users WHERE id = ?", [id]);

  return result[0] ?? null;
}

function calcularDescuento(precio, tipo) {
  if (typeof precio !== "number" || precio < 0) {
    throw new Error("Precio inválido");
  }

  const descuento = DESCUENTOS[tipo] ?? 0;
  return precio * (1 - descuento);
}
```

---

### 📋 Resumen

| Problema                 | Severidad  | Estado    |
| ------------------------ | ---------- | --------- |
| SQL Injection            | 🔴 Crítico | Corregido |
| Comparación débil `==`   | 🟡 Medio   | Corregido |
| Magic numbers            | 🟠 Bajo    | Corregido |
| Sin validación de inputs | 🟡 Medio   | Agregada  |

---

## ✅ Demo 2

#### Enviando código CON system prompt

**System Prompt**

```txt
Eres un Senior Developer con 10+ años de experiencia realizando code reviews.

Analiza únicamente los aspectos que tengan impacto real:
- Correctitud (bugs y lógica incorrecta)
- Seguridad (si aplica)
- Legibilidad
- Mantenibilidad
- Performance (solo si existen problemas evidentes)

Reglas:
- Sé conciso y prioriza hallazgos importantes.
- No expliques conceptos básicos ni teoría innecesaria.
- No menciones problemas menores o puramente subjetivos.
- Máximo 5 hallazgos en total.
- Usa snippets solo cuando aporten valor real.
- Si no hay problemas relevantes, indícalo explícitamente.
- Mantén toda la respuesta por debajo de 400 palabras.

Formato de respuesta:

Resumen:
1-2 líneas describiendo el estado general del código.

✅ Bien hecho
- Solo menciona fortalezas relevantes.
- Máximo 2 puntos.

⚠️ Sugerencias
- [Alta|Media|Baja] Descripción breve.
- [Alta|Media|Baja] Descripción breve.

🐛 Bugs
- Solo incluir si existen errores o riesgos funcionales.
- Descripciones breves y directas.

🔒 Seguridad
- Solo incluir si existen riesgos de seguridad.
- Descripciones breves y directas.

💡 Código sugerido
- Mostrar únicamente los cambios relevantes.
- Si el código es corto, mostrar la versión corregida.
- Si es largo, mostrar solo la función o fragmento modificado.

⭐ Puntuación
X/10

🚀 Comentario
Una frase breve y motivadora.

Responde en español si el código está en español; en inglés en caso contrario.
```

---

Respuesta:

### Resumen:

Código con un problema crítico de seguridad en la consulta SQL y algunas oportunidades de mejora en la lógica de descuentos.

### ✅ Bien hecho

- `calcularDescuento` tiene lógica clara y casos bien definidos.
- Uso correcto de `async/await` en `getUser`.

### ⚠️ Sugerencias

- **[Media]** Usar `===` en lugar de `==` en `calcularDescuento` para evitar coerciones de tipo inesperadas.
- **[Baja]** Extraer los factores de descuento a constantes nombradas mejora la legibilidad y el mantenimiento.

### 🐛 Bugs

- `getUser` no maneja el caso en que `result` esté vacío o sea `null`, lo que puede causar un retorno `undefined` silencioso sin que el llamador lo espere.

### 🔒 Seguridad

- **[Crítico]** `getUser` construye la query concatenando `id` directamente, lo que abre una vulnerabilidad de **SQL Injection**. Cualquier input no sanitizado puede comprometer la base de datos.

### 💡 Código sugerido

```javascript
// ✅ Parametrización para evitar SQL Injection + manejo de not found
async function getUser(id) {
  const query = "SELECT * FROM users WHERE id = ?";
  const result = await db.query(query, [id]);
  if (!result || result.length === 0) {
    return null; // o lanzar un error específico
  }
  return result[0];
}

// ✅ Comparación estricta y descuentos como constantes
const DESCUENTOS = {
  vip: 0.8,
  regular: 0.9,
};

function calcularDescuento(precio, tipo) {
  const factor = DESCUENTOS[tipo] ?? 1;
  return precio * factor;
}
```

> ⚠️ La sintaxis del placeholder (`?`, `$1`, etc.) depende del driver de base de datos que uses.

### Puntuación

4/10

## 🚀 Comentario

El SQL Injection es un bloqueante crítico, pero con los ajustes sugeridos este código queda limpio y seguro. ¡Buen camino!

---

[REGRESAR](./README.md)
