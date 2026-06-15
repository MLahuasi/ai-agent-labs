# Referencia del Lenguaje Python

Esta referencia agrupa las construcciones de Python usadas en los laboratorios del proyecto.

## Modulos e Imports

### `import`

**Para que sirve:** carga un modulo completo para usar sus funciones, clases o constantes.

**Cuando se usa:** cuando se necesita acceder a una libreria estandar, externa o propia del proyecto.

**Ejemplo:**

```python
import time

time.sleep(1)
```

### `from ... import ...`

**Para que sirve:** importa nombres especificos desde un modulo.

**Cuando se usa:** cuando solo se necesita una funcion, clase o constante concreta.

**Ejemplo:**

```python
from dotenv import load_dotenv

load_dotenv()
```

### Ajuste de ruta de importacion con `sys.path`

**Para que sirve:** agrega una carpeta a las rutas donde Python busca modulos.

**Cuando se usa:** cuando un script vive en un subdirectorio, pero necesita importar modulos comunes ubicados en otro directorio del proyecto, como `labs/config`.

**Ejemplo:**

```python
import sys
from pathlib import Path

LABS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LABS_DIR))
```

En los laboratorios del repositorio, `parents[2]` suele ser correcto para scripts dentro de `labs/01-api-config/...`. En [labs/03-recursos-agentes-ia/main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py) se usa `parents[1]` porque el archivo esta un nivel mas cerca de `labs/`.

### `__file__`

**Para que sirve:** contiene la ruta del archivo Python que se esta ejecutando o importando.

**Cuando se usa:** cuando se necesita calcular rutas relativas al archivo actual sin depender del directorio desde donde se ejecuto el comando.

**Ejemplo:**

```python
from pathlib import Path

current_file = Path(__file__)
print(current_file.name)
```

En este repositorio se usa mucho junto con `Path.resolve()` para que las rutas a `data/`, `config/` o `labs/` no dependan del directorio de ejecucion.

### Acceso a atributos e indices

**Para que sirve:** permite navegar objetos y colecciones usando `.` y `[]`.

**Cuando se usa:** para leer propiedades de respuestas de SDKs, acceder a elementos de listas o tomar un directorio padre de una ruta.

**Ejemplo:**

```python
base_dir = Path(__file__).resolve().parents[1]
answer = response.choices[0].message.content
```

Cuando se trabaja con distintos proveedores, tambien es comun leer el texto desde:

```python
gemini_text = response.text
openai_text = response.choices[0].message.content
ollama_text = response.message.content
```

### Operador `/` de `Path`

**Para que sirve:** construye rutas de archivos y carpetas de forma portable.

**Cuando se usa:** cuando se trabaja con `pathlib.Path` y se quiere evitar concatenar strings manualmente.

**Ejemplo:**

```python
from pathlib import Path

data_dir = Path("labs") / "03-recursos-agentes-ia" / "data"
```

Este patron es el recomendado para laboratorios del proyecto.

## Funciones y Retornos

### `def`

**Para que sirve:** define una funcion reutilizable.

**Cuando se usa:** cuando se quiere agrupar una accion con nombre, parametros y posible valor de retorno.

**Ejemplo:**

```python
def greet(name: str) -> str:
    return f"Hola {name}"
```

### `return`

**Para que sirve:** termina la funcion y devuelve un valor.

**Cuando se usa:** cuando una funcion debe entregar un resultado al codigo que la llamo.

**Ejemplo:**

```python
def double(value: int) -> int:
    return value * 2
```

### Funciones anidadas

**Para que sirven:** definen una funcion dentro de otra funcion.

**Cuando se usan:** cuando una funcion auxiliar solo tiene sentido dentro de un flujo especifico y necesita acceder a datos del contexto externo.

**Ejemplo:**

```python
def outer() -> str:
    def inner() -> str:
        return "hola"

    return inner()
```

En [labs/03-recursos-agentes-ia/main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py), `chat()` vive dentro de `main()` porque usa `openia_client`, `history` y `HISTORY_FILE` del contexto externo.

### `nonlocal`

**Para que sirve:** permite modificar una variable definida en una funcion externa.

**Cuando se usa:** cuando una funcion anidada necesita guardar o actualizar estado del contexto que la contiene.

**Ejemplo:**

```python
def counter() -> int:
    value = 0

    def increment() -> None:
        nonlocal value
        value = value + 1

    increment()
    return value
```

### `lambda`

**Para que sirve:** crea una funcion pequena y anonima en una sola expresion.

**Cuando se usa:** cuando se necesita pasar una funcion simple como argumento.

**Ejemplo:**

```python
operation = lambda: "resultado"
print(operation())
```

### Anotaciones de tipo

**Para que sirven:** documentan el tipo esperado de parametros, variables o retornos.

**Cuando se usan:** cuando se quiere mejorar legibilidad y soporte de herramientas como Pylance o Pyright.

**Ejemplo:**

```python
def add(left: int, right: int) -> int:
    return left + right
```

En este proyecto conviene preferir tipos concretos del SDK o colecciones tipadas antes que `Any`, para que `pyright` pueda detectar errores reales durante los cambios entre proveedores.

### Genericos de colecciones

**Para que sirven:** expresan el tipo esperado dentro de listas, diccionarios, tuplas u otras colecciones.

**Cuando se usan:** cuando se quiere que Pyright valide la forma de `messages`, respuestas o configuraciones compartidas entre laboratorios.

**Ejemplo:**

```python
messages: list[dict[str, str]] = []
models: tuple[str, str] = ("gpt-5-nano", "qwen2.5-coder:3b")
```

En el laboratorio de recursos aparece este caso:

```python
history: list[ChatMessage] = [
    {"role": "system", "content": system_prompt}
]
```

### Tipado estricto

**Para que sirve:** obliga a declarar mejor las formas de los datos y hace visibles errores de compatibilidad entre funciones y modulos.

**Cuando se usa:** cuando el proyecto ejecuta `pyright` con `typeCheckingMode = "strict"` y se quiere mantener contratos coherentes entre Gemini, OpenAI, Groq y Ollama.

**Ejemplo:**

```python
def get_response_text(response: ChatCompletion) -> str:
    ...
```

### Parametros con valor por defecto

**Para que sirven:** permiten llamar una funcion sin pasar todos los argumentos.

**Cuando se usan:** cuando existe un valor comun o recomendado para un parametro.

**Ejemplo:**

```python
def retry(max_retries: int = 3) -> None:
    print(max_retries)
```

### Union de tipos con `|`

**Para que sirve:** indica que un valor puede tener mas de un tipo.

**Cuando se usa:** cuando un parametro puede recibir un valor real o `None`.

**Ejemplo:**

```python
def show(previous_id: str | None = None) -> None:
    print(previous_id)
```

### Llamadas con argumentos nombrados

**Para que sirven:** pasan valores indicando explicitamente el nombre del parametro.

**Cuando se usan:** cuando una llamada tiene varios argumentos o se quiere hacer el codigo mas claro.

**Ejemplo:**

```python
response = client.chat.completions.create(
    model="gpt-5-nano",
    messages=[{"role": "user", "content": "Hola"}],
)
```

## Gestion de recursos y archivos

### `with`

**Para que sirve:** abre un contexto controlado y garantiza que el recurso se cierre al salir del bloque, incluso si ocurre un error.

**Cuando se usa:** principalmente con archivos, conexiones o locks que deben liberarse correctamente.

**Ejemplo:**

```python
with open("summary.txt", "r", encoding="utf-8") as file:
    summary = file.read()
```

En [labs/03-recursos-agentes-ia/main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py) se usa varias veces para leer `summary.txt`, leer `history.json` y volver a escribir ese historial.

### `open()`

**Para que sirve:** abre un archivo para lectura, escritura o agregacion.

**Cuando se usa:** cuando el programa necesita cargar datos externos o persistir informacion en disco.

**Ejemplo:**

```python
with open("history.json", "w", encoding="utf-8") as file:
    file.write("[]")
```

Los modos mas comunes en este proyecto son:

- `"r"`: leer.
- `"w"`: sobrescribir o crear.

### `try` / `finally`

**Para que sirve:** ejecuta siempre el bloque `finally`, haya error o no.

**Cuando se usa:** cuando hay limpieza o persistencia obligatoria al final de una operacion larga.

**Ejemplo:**

```python
try:
    run_server()
finally:
    save_history()
```

En [labs/03-recursos-agentes-ia/main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py) se usa para guardar el historial incluso cuando la interfaz de Gradio se cierra inesperadamente.

## Texto y Formato

### Strings

**Para que sirven:** representan texto.

**Cuando se usan:** para mensajes, prompts, nombres de variables de entorno, modelos o salidas por consola.

**Ejemplo:**

```python
model = "gemini-2.5-flash-lite"
```

### Strings multilinea por concatenacion implicita

**Para que sirven:** permiten dividir un texto largo en varias lineas dentro de parentesis.

**Cuando se usan:** cuando un prompt o mensaje largo debe mantenerse legible.

**Ejemplo:**

```python
question = (
    "Si cinco maquinas fabrican cinco articulos "
    "en cinco minutos, cuanto tardan cien maquinas?"
)
```

En [labs/03-recursos-agentes-ia/main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py), esta tecnica se usa para agregar reglas largas al `system_prompt` sin perder legibilidad.

### f-strings

**Para que sirven:** insertan valores de variables o expresiones dentro de un string.

**Cuando se usan:** para construir mensajes dinamicos.

**Ejemplo:**

```python
status_code = 503
print(f"Error temporal: {status_code}")
```

### `.strip()`

**Para que sirve:** elimina espacios, saltos de linea y tabulaciones al inicio y final de un string.

**Cuando se usa:** cuando se valida texto recibido desde una API o entrada de usuario.

**Ejemplo:**

```python
text = "  hola  "
clean_text = text.strip()
```

## Colecciones y Constantes

### Listas

**Para que sirven:** guardan una secuencia ordenada de valores.

**Cuando se usan:** cuando se necesita enviar varios mensajes, partes o elementos en orden.

**Ejemplo:**

```python
messages = ["hola", "como estas?"]
```

### Tuplas

**Para que sirven:** agrupan varios valores en una estructura ordenada e inmutable.

**Cuando se usan:** cuando una funcion necesita devolver mas de un valor relacionado.

**Ejemplo:**

```python
def get_pair() -> tuple[str, str]:
    return "respuesta", "response_id"
```

### Desempaquetado de tuplas

**Para que sirve:** asigna los valores de una tupla a variables individuales.

**Cuando se usa:** cuando una funcion devuelve varios valores y se quiere trabajar con ellos por separado.

**Ejemplo:**

```python
answer, response_id = get_pair()
```

### Diccionarios y objetos de mensajes

**Para que sirven:** en el proyecto se crean estructuras de mensajes para enviar prompts y conservar contexto de conversacion.

**Cuando se usan:** cuando una libreria espera estructuras con campos claros, como `role`, `content` o `model`.

**Ejemplo:**

```python
message = {"role": "user", "content": "Hola"}
assistant = {"role": "assistant", "model": "gpt-5-nano", "content": "Hola"}
```

Eso permite mover conversaciones entre OpenAI, Gemini, Groq y Ollama con una estructura comun.

### Comprensiones y expresiones generadoras

**Para que sirven:** crean colecciones o producen elementos de forma compacta.

**Cuando se usan:** cuando se quiere filtrar, transformar o extender listas sin escribir un bucle completo.

**Ejemplo:**

```python
history.extend(
    item
    for item in persisted
    if item["role"] != "system"
)
```

Ese patron aparece en [labs/03-recursos-agentes-ia/main.py](/D:/Fuentes/Core/ai-agent-labs/labs/03-recursos-agentes-ia/main.py) para reconstruir historial persistido sin duplicar el `system` prompt.

### `frozenset`

**Para que sirve:** crea un conjunto inmutable de valores unicos.

**Cuando se usa:** cuando una coleccion no debe modificarse despues de declararse, como codigos HTTP retryables.

**Ejemplo:**

```python
RETRYABLE_STATUS_CODES = frozenset({429, 500, 503})
```

### Constantes en mayusculas

**Para que sirven:** comunican que un valor debe tratarse como configuracion fija.

**Cuando se usan:** para nombres de modelo, codigos permitidos o valores compartidos.

**Ejemplo:**

```python
MODEL_NAME = "gemini-2.5-flash-lite"
```

## Condicionales y Validacion

### `if`

**Para que sirve:** ejecuta codigo solo si una condicion se cumple.

**Cuando se usa:** para validar datos, decidir flujos o manejar casos especiales.

**Ejemplo:**

```python
if text is None:
    raise ValueError("No hay texto")
```

En el laboratorio de recursos tambien se usa para evitar concatenar paginas vacias extraidas del PDF:

```python
if text:
    cv += text
```

### `if not`

**Para que sirve:** valida que un valor sea falso, vacio o inexistente.

**Cuando se usa:** para detectar strings vacios, `None`, listas vacias o variables no configuradas.

**Ejemplo:**

```python
if not api_key:
    raise RuntimeError("Falta la API key")
```

### `is None`

**Para que sirve:** comprueba si un valor es exactamente `None`.

**Cuando se usa:** cuando se necesita diferenciar ausencia de valor frente a otros valores falsos como `""` o `0`.

**Ejemplo:**

```python
if response is None:
    raise ValueError("Respuesta nula")
```

### `not in`

**Para que sirve:** comprueba que un valor no pertenezca a una coleccion.

**Cuando se usa:** para validar si un codigo, opcion o elemento esta fuera de un conjunto permitido.

**Ejemplo:**

```python
if status_code not in RETRYABLE_STATUS_CODES:
    raise
```

## Bucles y Reintentos

### `for`

**Para que sirve:** repite un bloque de codigo por cada elemento de una secuencia.

**Cuando se usa:** para recorrer listas, paginas de un PDF o ejecutar intentos controlados.

**Ejemplo:**

```python
for name in ["Ana", "Luis"]:
    print(name)
```

### `range()`

**Para que sirve:** genera una secuencia de numeros.

**Cuando se usa:** cuando se necesita repetir algo una cantidad conocida de veces.

**Ejemplo:**

```python
for attempt in range(1, 4):
    print(attempt)
```

### Operador `**`

**Para que sirve:** calcula potencias.

**Cuando se usa:** para operaciones matematicas, como backoff exponencial en reintentos.

**Ejemplo:**

```python
attempt = 2
wait_seconds = 2 ** attempt
```

## Excepciones y Errores

### `try` / `except`

**Para que sirve:** captura errores para manejarlos sin que el programa termine inmediatamente.

**Cuando se usa:** al llamar APIs, leer archivos, convertir datos o ejecutar operaciones que pueden fallar.

**Ejemplo:**

```python
try:
    result = risky_operation()
except RuntimeError as error:
    print(error)
```

`try/except` y `try/finally` no resuelven el mismo problema:

- `try/except` maneja errores.
- `try/finally` garantiza limpieza o persistencia.

### `raise`

**Para que sirve:** lanza una excepcion.

**Cuando se usa:** cuando una funcion detecta un estado invalido o quiere propagar un error.

**Ejemplo:**

```python
if not text:
    raise ValueError("Texto vacio")
```

### `raise ... from error`

**Para que sirve:** lanza una nueva excepcion conservando la causa original.

**Cuando se usa:** cuando se quiere dar un mensaje mas claro sin perder el error base.

**Ejemplo:**

```python
try:
    call_api()
except Exception as error:
    raise RuntimeError("La API fallo") from error
```

### `getattr()`

**Para que sirve:** obtiene un atributo de un objeto de forma segura, con valor por defecto si no existe.

**Cuando se usa:** cuando el objeto puede o no tener un atributo, como `error.code` o `error.status_code`.

**Ejemplo:**

```python
status_code = getattr(error, "status_code", None)
```

## Ejecucion de Scripts

### `if __name__ == "__main__"`

**Para que sirve:** ejecuta codigo solo cuando el archivo se corre directamente como script.

**Cuando se usa:** para permitir que un archivo funcione como programa principal y tambien pueda importarse desde otros modulos.

**Ejemplo:**

```python
def main() -> None:
    print("Hola")


if __name__ == "__main__":
    main()
```

## Salida por Consola

### `print()`

**Para que sirve:** escribe texto o valores en la consola.

**Cuando se usa:** para mostrar resultados, diagnosticos simples o mensajes de progreso en scripts de aprendizaje.

**Ejemplo:**

```python
print("La clave API existe.")
```
