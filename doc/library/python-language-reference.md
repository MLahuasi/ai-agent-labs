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

En los laboratorios del repositorio, `parents[2]` suele ser el ajuste correcto porque los scripts viven dentro de subcarpetas como `labs/01-api-config/gemini/`, `labs/01-api-config/openia/` y `labs/01-api-config/ollama/`.

### `__file__`

**Para que sirve:** contiene la ruta del archivo Python que se esta ejecutando o importando.

**Cuando se usa:** cuando se necesita calcular rutas relativas al archivo actual sin depender del directorio desde donde se ejecuto el comando.

**Ejemplo:**

```python
from pathlib import Path

current_file = Path(__file__)
print(current_file.name)
```

### Acceso a atributos e indices

**Para que sirve:** permite navegar objetos y colecciones usando `.` y `[]`.

**Cuando se usa:** para leer propiedades de respuestas de SDKs, acceder a elementos de listas o tomar un directorio padre de una ruta.

**Ejemplo:**

```python
base_dir = Path(__file__).resolve().parents[1]
answer = response.choices[0].message.content
```

Cuando se trabaja con laboratorios de Gemini, OpenIA/OpenAI u Ollama, tambien es comun leer el texto desde:

```python
gemini_text = response.text
openai_text = response.choices[0].message.content
ollama_text = response.message.content
```

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

**Cuando se usa:** cuando un parametro puede recibir un valor real o `None`, por ejemplo un identificador opcional.

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
response = client.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents="Hola",
)
```

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

**Cuando se usan:** cuando una funcion necesita devolver mas de un valor relacionado, como texto de respuesta e identificador de respuesta.

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

**Para que sirven:** en el laboratorio se crean estructuras de mensajes para enviar prompts y conservar contexto de conversacion.

**Cuando se usan:** cuando una libreria espera estructuras con campos claros, como `role` y `parts`, o diccionarios simples con `role` y `content`.

**Ejemplo:**

```python
gemini_item = types.Content(
    role="user",
    parts=[types.Part(text="Hola")],
)

openai_item = {"role": "user", "content": "Hola"}
ollama_item = {"role": "user", "content": "Hola"}
```

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

**Cuando se usa:** para recorrer listas o ejecutar intentos controlados.

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

**Cuando se usa:** cuando el objeto puede o no tener un atributo, como `error.code` o `response.text`.

**Ejemplo:**

```python
status_code = getattr(error, "code", None)
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
