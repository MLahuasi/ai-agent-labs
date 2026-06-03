# 🪟 Configuración del entorno en Windows con VS Code y uv

> Guía para preparar el ambiente de trabajo del repositorio `ai-agent-labs` en Windows.  
> El curso puede usar Cursor como referencia, pero este flujo está pensado para **VS Code + Python + uv**.

## 🎯 Objetivo

Al finalizar esta guía deberías tener:

- Git instalado.
- VS Code preparado para Python y notebooks.
- `uv` instalado como gestor de entorno, paquetes y versiones de Python.
- El proyecto abierto desde la raíz del repositorio.
- El entorno virtual de laboratorios creado en `labs/.venv`.
- VS Code y Pylance apuntando al intérprete correcto.
- Variables de entorno configuradas en `labs/.env`.
- Dependencias sincronizadas y verificadas.

## 1. ✅ Requisitos previos

Instala o ten disponibles estas herramientas:

- Git.
- VS Code.
- Python `>=3.12`.
- uv.
- Extensiones de VS Code para Python y Jupyter.
- Microsoft C++ Build Tools, solo si más adelante trabajas con paquetes que requieren compilación nativa.

> La versión actualmente usada por los laboratorios es Python `3.12.11`, declarada en `labs/.python-version`.

## 2. 🔧 Instalar Git

Descarga Git para Windows desde:

```txt
https://git-scm.com/download/win
```

Verifica la instalación:

```powershell
git --version
```

## 3. 🧩 Instalar VS Code y extensiones

Instala VS Code desde:

```txt
https://code.visualstudio.com/
```

Luego instala estas extensiones oficiales de Microsoft:

- Python.
- Jupyter.

Desde VS Code:

```txt
Extensions → Buscar "Python" → Instalar extensión oficial de Microsoft
Extensions → Buscar "Jupyter" → Instalar extensión oficial de Microsoft
```

Verifica que el `Publisher` sea `Microsoft`.

## 4. ⚡ Instalar uv

Instala uv siguiendo la documentación oficial:

```txt
https://docs.astral.sh/uv/getting-started/installation/
```

En Windows puedes usar PowerShell:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Cierra y vuelve a abrir la terminal. Después verifica:

```powershell
uv --version
```

Actualiza uv si ya lo tenías instalado:

```powershell
uv self update
```

uv se usa en este proyecto para:

- Gestionar entornos virtuales.
- Instalar paquetes.
- Sincronizar dependencias.
- Ejecutar scripts Python.
- Administrar versiones de Python cuando sea necesario.

## 5. 🧭 Abrir el proyecto

Abre una terminal en la carpeta donde quieras trabajar y entra al repositorio:

```powershell
cd D:\Fuentes\Core\ai-agent-labs
```

Abre el proyecto en VS Code desde la raíz:

```powershell
code .
```

También puedes abrirlo manualmente:

```txt
VS Code → File → Open Folder → seleccionar ai-agent-labs
```

> Abre siempre la raíz del repositorio, no solo `labs/`, porque la configuración del workspace vive en archivos de nivel raíz como `.vscode/settings.json` y `pyrightconfig.json`.

## 6. 🧹 Desactivar Conda si aplica

Si usas Anaconda o Miniconda y tienes un entorno activo, desactívalo:

```powershell
conda deactivate
```

Opcionalmente, evita que Conda active automáticamente el entorno base:

```powershell
conda config --set auto_activate_base false
```

## 7. 🐍 Preparar el entorno de laboratorios

El proyecto Python ejecutable vive dentro de:

```txt
labs/
```

Si estás configurando el repositorio desde cero y `labs/` todavía no existe, créalo primero:

```powershell
cd D:\Fuentes\Core\ai-agent-labs
New-Item -ItemType Directory -Name "labs"
cd labs
```

Después inicializa el proyecto Python con uv:

```powershell
uv init
```

Este comando crea los archivos base del proyecto, como:

```txt
labs/pyproject.toml
labs/.python-version
labs/README.md
```

Asegura que uv tenga disponible la versión de Python requerida:

```powershell
uv python install 3.12.11
```

Configura esa versión para el proyecto:

```powershell
uv python pin 3.12.11
```

Instala las dependencias necesarias para los laboratorios actuales:

```powershell
uv add google-genai openai ollama python-dotenv
```

Al instalar dependencias, uv actualiza:

```txt
labs/pyproject.toml
labs/uv.lock
```

Y crea o actualiza el entorno virtual:

```txt
labs/.venv/
```

En Windows, el intérprete esperado es:

```txt
D:\Fuentes\Core\ai-agent-labs\labs\.venv\Scripts\python.exe
```

Si `labs/` ya existe y contiene `pyproject.toml`, no necesitas ejecutar `uv init` otra vez. En ese caso, solo sincroniza dependencias desde `labs/`.

`uv sync` lee `pyproject.toml` y `uv.lock`, crea el entorno virtual si todavía no existe y deja `labs/.venv` con las dependencias exactas del proyecto. Úsalo después de clonar el repositorio, cambiar de rama, modificar dependencias o cuando quieras asegurar que el entorno local coincide con la configuración declarada.

```powershell
cd D:\Fuentes\Core\ai-agent-labs\labs
uv sync
```

Si aparece un problema de certificados, prueba:

```powershell
uv --native-tls sync
```

Si el problema continúa y sabes por qué necesitas permitir el host:

```powershell
uv --allow-insecure-host github.com sync
```

## 8. 🔐 Crear el archivo de variables de entorno

Para los laboratorios, el archivo de variables debe vivir en:

```txt
labs/.env
```

Puedes crearlo desde PowerShell:

```powershell
cd D:\Fuentes\Core\ai-agent-labs\labs
New-Item -ItemType File -Name ".env"
```

O desde VS Code:

```txt
File → New File → guardar como labs/.env
```

## 9. 🔑 Configurar API keys

Dentro de `labs/.env`, agrega las claves que necesites para cada laboratorio:

```env
OPENAI_API_KEY=tu_api_key_aqui
GEMINI_API_KEY=tu_api_key_aqui
OLLAMA_HOST=http://localhost:11434
GOOGLE_API_KEY=tu_api_key_aqui
ANTHROPIC_API_KEY=tu_api_key_aqui
DEEPSEEK_API_KEY=tu_api_key_aqui
```

Para los laboratorios de Gemini, la variable estándar del repositorio es:

```env
GEMINI_API_KEY=tu_api_key_aqui
```

Para los laboratorios de OpenIA/OpenAI, la variable estándar del repositorio es:

```env
OPENAI_API_KEY=tu_api_key_aqui
```

Para los laboratorios de Ollama, la variable opcional es:

```env
OLLAMA_HOST=http://localhost:11434
```

Ollama no usa API key. Solo necesita el servicio local en ejecucion y los modelos descargados.

No subas archivos `.env` a GitHub. Verifica que `.gitignore` incluya:

```gitignore
.env
.venv
labs/.env
labs/.venv
```

## 10. 🧠 Configurar VS Code

El repositorio puede indicar a VS Code qué intérprete usar mediante [.vscode/settings.json](../.vscode/settings.json):

Contenido recomendado:

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/labs/.venv/Scripts/python.exe",
  "python.terminal.useEnvFile": true,
  "python.envFile": "${workspaceFolder}/labs/.env"
}
```

Qué hace cada propiedad:

- `python.defaultInterpreterPath`: usa el Python del entorno virtual de `labs/`.
- `python.terminal.useEnvFile`: permite cargar variables desde `.env` en terminales Python.
- `python.envFile`: define `labs/.env` como archivo de entorno del workspace.

También puedes seleccionar manualmente el intérprete:

```txt
Ctrl + Shift + P
Python: Select Interpreter
Seleccionar labs\.venv\Scripts\python.exe
```

Si VS Code mantiene advertencias antiguas, recarga la ventana:

```txt
Ctrl + Shift + P
Developer: Reload Window
```

## 11. 🔎 Configurar Pylance y Pyright

Pylance usa Pyright para analizar imports y tipos. Para que analice los laboratorios con el entorno correcto, el repositorio debe tener [pyrightconfig.json](../pyrightconfig.json):

Contenido recomendado:

```json
{
  "include": ["labs"],
  "venvPath": "./labs",
  "venv": ".venv"
}
```

Qué hace cada propiedad:

- `include`: limita el análisis principal a `labs/`.
- `venvPath`: indica dónde buscar entornos virtuales.
- `venv`: indica el nombre del entorno virtual.

Esta configuración ayuda a evitar advertencias como:

```txt
No se ha podido resolver la importación "dotenv". Pylance reportMissingImports
```

## 12. ✅ Validar la instalación

Verifica la versión de Python del entorno:

```powershell
cd D:\Fuentes\Core\ai-agent-labs\labs
.\.venv\Scripts\python.exe --version
```

Salida esperada actualmente:

```txt
Python 3.12.11
```

Verifica imports básicos de los laboratorios actuales:

```powershell
.\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; from google import genai; from openai import OpenAI; from ollama import Client; print('imports ok')"
```

Salida esperada:

```txt
imports ok
```

También puedes validar con uv:

```powershell
uv run python -c "from dotenv import load_dotenv; from google import genai; from openai import OpenAI; from ollama import Client; print('imports ok')"
```

## 13. ▶️ Ejecutar laboratorios

Ejecuta un archivo Python desde el directorio del laboratorio correspondiente.

Ejemplo:

```powershell
cd D:\Fuentes\Core\ai-agent-labs\labs\01-gemini-api-config
uv run python main.py
```

Tambien puedes ejecutar desde `labs/` apuntando al directorio del laboratorio:

```powershell
cd D:\Fuentes\Core\ai-agent-labs\labs
uv run python .\01-api-config\gemini\main.py
uv run python .\01-api-config\openia\main.py
uv run python .\01-api-config\ollama\main.py
```

Los laboratorios pueden reutilizar configuracion por proveedor desde:

```txt
labs/config/gemini/
labs/config/openia/
labs/config/ollama/
```

Cada laboratorio agrega `labs/` a `sys.path` cuando necesita importar esos modulos de configuracion.

Si usas notebooks, selecciona el kernel del entorno:

```txt
Select Kernel → Python Environments → labs\.venv
```

Luego ejecuta celdas con:

```txt
Shift + Enter
```

## 14. 🛠️ Comandos frecuentes

Desde `labs/`:

Sincronizar `.venv` con `pyproject.toml` y `uv.lock` (dependencias).

```powershell
uv sync
```

Agregar una dependencia:

```powershell
uv add nombre-paquete
```

Ejemplo:

```powershell
uv add google-genai openai ollama python-dotenv
```

Eliminar una dependencia:

```powershell
uv remove nombre-paquete
```

Actualizar lockfile:

```powershell
uv lock
```

Ver paquetes instalados:

```powershell
uv pip list
```

Ejecutar Python dentro del entorno:

```powershell
uv run python main.py
```

## 15. 🧪 Instalar CrewAI como herramienta global

Este paso es útil para módulos relacionados con CrewAI, pero no es necesario para preparar el primer laboratorio de Gemini.

```powershell
uv tool install crewai
uv tool upgrade crewai
```

## 16. 🧭 Cursor vs VS Code

Cursor es un editor basado en VS Code con funciones integradas de IA. No es obligatorio para este repositorio.

Para seguir el curso basta con:

```txt
VS Code + Python Extension + Jupyter Extension + uv
```

Cursor puede instalarse opcionalmente para comparar flujos de trabajo con IA, pero no reemplaza ningún requisito técnico de esta guía.

## 17. 📋 Checklist final

- [ ] Git instalado.
- [ ] VS Code instalado.
- [ ] Extensión Python instalada.
- [ ] Extensión Jupyter instalada.
- [ ] uv instalado.
- [ ] Repositorio abierto desde la raíz.
- [ ] Conda desactivado si aplica.
- [ ] `labs/` creado si no existía.
- [ ] `uv init` ejecutado dentro de `labs/` si no existía `labs/pyproject.toml`.
- [ ] Dependencias base instaladas con `uv add google-genai openai ollama python-dotenv`.
- [ ] `uv sync` ejecutado desde `labs/`.
- [ ] `labs/.venv` creado.
- [ ] `labs/.env` creado.
- [ ] API keys configuradas si aplica.
- [ ] VS Code usa `labs/.venv/Scripts/python.exe`.
- [ ] Pyright/Pylance apuntan a `labs/.venv`.
- [ ] Imports básicos validados.
- [ ] Primer laboratorio ejecutado correctamente.

## 📎 Anexos

### A. Cambiar la versión de Python del entorno

Este procedimiento está fuera de la instalación diaria. Úsalo cuando necesites cambiar la versión de Python del entorno virtual de `labs/`.

#### A.1. Instalar la versión requerida de Python con uv

Para instalar la versión usada actualmente por los laboratorios:

```powershell
uv python install 3.12.11
```

Verifica que uv la detecte:

```powershell
uv python list
```

#### A.2. Configurar la versión esperada

Edita:

```txt
labs/.python-version
```

Y deja:

```txt
3.12.11
```

#### A.3. Cerrar procesos que usen el entorno

Antes de borrar `.venv`, cierra terminales, notebooks o procesos que lo estén usando.

Si la terminal muestra el entorno activo, por ejemplo `(labs)`, intenta:

```powershell
deactivate
```

Si no funciona, cierra la terminal integrada de VS Code y abre una nueva.

#### A.4. Borrar solo el entorno virtual

Desde `labs/`:

```powershell
Remove-Item -LiteralPath ".\.venv" -Recurse -Force
```

Este comando elimina solo:

```txt
labs/.venv
```

No elimina `labs/` ni los archivos de los laboratorios.

#### A.5. Recrear el entorno

Desde `labs/`:

```powershell
uv sync
```

Si uv encuentra la versión configurada, debería mostrar algo similar a:

```txt
Using CPython 3.12.11
Creating virtual environment at: .venv
```

#### A.6. Verificar la versión e imports

```powershell
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; from google import genai; from openai import OpenAI; from ollama import Client; print('imports ok')"
```

### B. Inicializar un proyecto uv desde cero

Este anexo aplica si estás creando otro proyecto Python fuera de `labs/` o si necesitas repetir el patrón en un nuevo laboratorio independiente.

```powershell
uv init
uv venv
uv add openai jupyter ipykernel
```

Estructura esperada:

```txt
mi-proyecto
├── .venv
├── pyproject.toml
├── uv.lock
└── README.md
```

### C. Verificar si un paquete está instalado

La forma más directa es importarlo usando el Python del entorno virtual.

Desde la raíz del proyecto:

```powershell
.\labs\.venv\Scripts\python.exe -c "import dotenv; print(dotenv.__file__)"
```

Si está instalado, obtendrás una ruta similar a:

```txt
D:\Fuentes\Core\ai-agent-labs\labs\.venv\Lib\site-packages\dotenv\__init__.py
```

### D. Nombres de paquetes vs nombres de imports

El nombre usado para instalar un paquete no siempre coincide con el nombre usado para importarlo.

Ejemplo:

```powershell
uv add python-dotenv
```

Pero en Python se importa así:

```python
from dotenv import load_dotenv
```

### E. Warning de hardlinks en uv

Durante `uv sync` puede aparecer un warning como:

```txt
warning: Failed to hardlink files; falling back to full copy.
```

No es un error. Significa que uv no pudo usar hardlinks desde su caché y copió los archivos normalmente. El entorno queda funcional.

Si quieres ocultar el warning, puedes usar:

```powershell
uv sync --link-mode=copy
```

### F. Cuando Pylance sigue mostrando warnings

Si el paquete se puede importar por consola pero Pylance sigue mostrando advertencias, normalmente el problema no es la instalación. Causas comunes:

- VS Code está usando otro intérprete Python.
- Pylance conserva caché anterior.
- La ventana de VS Code necesita recargarse.

Acciones recomendadas:

```txt
Python: Select Interpreter → labs\.venv\Scripts\python.exe
Developer: Reload Window
Cerrar y abrir de nuevo el archivo Python afectado
```

## Menu

- [Configuracion de Gemini API](../labs/config/gemini-api-config.md)
- [Configuracion de OpenIA API](../labs/config/openia-api-config.md)
- [Configuracion de Ollama API](../labs/config/ollama-api-config.md)
- [REGRESAR](./README.md)
