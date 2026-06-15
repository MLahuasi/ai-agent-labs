# RECURSOS - AGENTES DE IA

Un recurso es informacion que se entrega al modelo para mejorar la calidad de su respuesta sin darle capacidad de actuar sobre el entorno. Un recurso no ejecuta acciones; amplia el contexto disponible.

## Relacion con los frameworks

En [frameworks-IA-agentica.md](./frameworks-IA-agentica.md) se distingue entre:

- `Recursos`: contexto adicional para responder mejor.
- `Herramientas`: capacidades para ejecutar acciones.

El archivo [main.py](../labs/03-recursos-agentes-ia/main.py) implementa el caso de `recursos`. El modelo no consulta fuentes externas durante la conversación ni decide invocar funciones. Toda su capacidad depende de la informacion cargada previamente y colocada dentro del `system_prompt`.

## Como se aplican recursos en el laboratorio

### 1. Recurso documental desde PDF

En [main.py](../labs/03-recursos-agentes-ia/main.py) se usa `pypdf.PdfReader` para abrir [CV_Bilbo_Bolson.pdf](../labs/03-recursos-agentes-ia/data/CV_Bilbo_Bolson.pdf), recorrer sus paginas y extraer texto:

```python
reader = PdfReader(DATA_DIR / "CV_Bilbo_Bolson.pdf")
cv = ""
for page in reader.pages:
    text = page.extract_text()
    if text:
        cv += text
```

Ese PDF funciona como una fuente de conocimiento del agente. No es una herramienta; es contexto convertido a texto.

### 2. Recurso textual desde archivo plano

Tambien se lee [summary.txt](../labs/03-recursos-agentes-ia/data/summary.txt):

```python
with open(DATA_DIR / "summary.txt", "r", encoding="utf-8") as f:
    summary = f.read()
```

Este archivo agrega una segunda capa de contexto, probablemente mas sintetica o curada que el PDF.

### 3. Inyeccion de recursos en el `system_prompt`

Los dos recursos anteriores se insertan dentro del prompt del sistema:

```python
system_prompt = f"""
...
## Información de referencia:

{summary}

## Información adicional:

{cv}
"""
```

Este es el patron central: el recurso se transforma en texto y se entrega al modelo antes de conversar con el usuario.

### 4. Restriccion explicita de uso del recurso

El laboratorio no solo entrega datos; tambien restringe el comportamiento del modelo para que responda usando exclusivamente ese material:

```python
system_prompt += (
    "\n\nRegla obligatoria: responde únicamente usando la información "
    "incluida en 'Información de referencia' e 'Información adicional'. "
    "No uses conocimiento externo. Si la respuesta no consta en esas fuentes, "
    "indícalo de forma honesta y manteniendo el personaje."
)
```

Eso reduce alucinaciones y hace visible una idea importante: un recurso es util cuando el prompt define con claridad como debe usarse.

### 5. Persistencia del historial como recurso acumulado

El archivo [history.json](../labs/03-recursos-agentes-ia/data/history.json) permite reconstruir la conversación previa:

```python
if HISTORY_FILE.exists():
    with open(HISTORY_FILE, "r", encoding="utf-8") as file:
        persisted = json.load(file)

    history.extend(
        item
        for item in persisted
        if item["role"] != "system"
    )
```

Aqui el historial tambien se convierte en un recurso. No describe al personaje como el PDF o el resumen, pero si aporta memoria conversacional.

## Flujo conceptual

1. El programa carga recursos locales (`PDF`, `TXT`, `JSON`).
2. Convierte esos recursos en texto o historial estructurado.
3. Inserta ese contenido en el contexto inicial del modelo.
4. El usuario conversa con el agente.
5. El historial se persiste para que la siguiente ejecucion recupere memoria.

## Idea clave

En este laboratorio, el agente no "sabe" quien es Bilbo por si mismo. Lo sabe porque el programa le entrega recursos concretos y le exige responder solo con base en ellos. Esa es la aplicacion practica de recursos en IA agentica: controlar mejor la respuesta aumentando contexto, no autonomia.

## Referencias

- [Ver laboratorio](../labs/03-recursos-agentes-ia/main.py)
- [Ver marcos y niveles](./frameworks-IA-agentica.md)

[REGRESAR](./frameworks-IA-agentica.md)
