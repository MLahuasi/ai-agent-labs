# Configuracion del Entorno de Laboratorios

## Proposito

Este documento explica como validar y configurar el entorno Python usado por los laboratorios dentro de `labs/`.

El objetivo es evitar errores de VS Code o Pylance como:

```text
No se ha podido resolver la importacion "dotenv". Pylance reportMissingImports
```

## Entorno esperado

Los laboratorios usan el entorno virtual ubicado en:

```text
labs/.venv/
```

En Windows, el interprete Python esperado es:

```text
D:\Fuentes\Core\ai-agent-labs\labs\.venv\Scripts\python.exe
```

## Seleccionar interprete en VS Code

Si VS Code muestra errores de imports aunque el paquete este instalado, se debe revisar el interprete seleccionado.

Pasos:

1. Abrir la paleta de comandos con `Ctrl+Shift+P`.
2. Ejecutar `Python: Select Interpreter`.
3. Seleccionar:

```text
D:\Fuentes\Core\ai-agent-labs\labs\.venv\Scripts\python.exe
```

4. Recargar VS Code con `Ctrl+Shift+P` y luego `Developer: Reload Window`.

## Configuracion de VS Code

Para evitar seleccionar manualmente el interprete cada vez, el repositorio puede declarar la configuracion del workspace en [.vscode/settings.json](../../.vscode/settings.json)

Contenido recomendado:

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/labs/.venv/Scripts/python.exe",
  "python.terminal.useEnvFile": true,
  "python.envFile": "${workspaceFolder}/labs/.env"
}
```

Que hace cada propiedad:

- `python.defaultInterpreterPath`: indica a VS Code que use el Python del entorno virtual de `labs/`.
- `python.terminal.useEnvFile`: permite que VS Code cargue variables desde un archivo `.env` en terminales Python.
- `python.envFile`: define que el archivo de entorno del proyecto es `labs/.env`.

Esta configuracion es necesaria porque el workspace se abre desde la raiz del repositorio, pero el entorno Python real vive dentro de `labs/.venv`.

## Configuracion de Pylance y Pyright

Pylance usa Pyright para analizar imports y tipos. Para que analice los laboratorios con el entorno virtual correcto, se puede crear [pyrightconfig.json](../../pyrightconfig.json)

Contenido recomendado:

```json
{
  "include": ["labs"],
  "venvPath": "./labs",
  "venv": ".venv"
}
```

Que hace cada propiedad:

- `include`: limita el analisis principal a la carpeta `labs/`.
- `venvPath`: indica donde buscar entornos virtuales.
- `venv`: indica el nombre del entorno virtual que debe usar Pyright.

Esta configuracion ayuda a evitar warnings como `reportMissingImports` cuando el paquete esta instalado pero Pylance no esta resolviendo imports desde `labs/.venv`.

## Sincronizar dependencias con uv

Las dependencias de `labs/` se declaran en [labs/pyproject.toml](../../labs/pyproject.toml)

Para sincronizar el entorno virtual con ese archivo:

```powershell
cd labs
uv sync
```

Para agregar una nueva dependencia:

```powershell
cd labs
uv add nombre-del-paquete
```

Ejemplo:

```powershell
cd labs
uv add google-genai python-dotenv
```

## Cambiar version de Python del entorno

El entorno virtual de los laboratorios vive en:

```text
labs/.venv
```

Si se quiere cambiar la version de Python usada por ese entorno, por ejemplo a Python `3.12.11`, se debe recrear `.venv`.

### 1. Configurar la version esperada

Editar [labs/.python-version](../.python-version)

Y dejar:

```text
3.12.11
```

### 2. Cerrar procesos que usen el entorno

Antes de borrar `.venv`, cerrar terminales o procesos que lo esten usando.

Si la terminal muestra el entorno activo, por ejemplo `(labs)`, se puede desactivar con:

```powershell
deactivate
```

Si `deactivate` no existe o no hace nada, cerrar la terminal integrada de VS Code y abrir una nueva.

### 3. Borrar solo `.venv`

Desde `labs/`:

```powershell
Remove-Item -LiteralPath ".\.venv" -Recurse -Force
```

Este comando elimina solo:

```text
labs/.venv
```

No elimina el directorio `labs/` ni los archivos del laboratorio.

### 4. Recrear el entorno con uv

Desde `labs/`:

```powershell
uv sync
```

Si `uv` encuentra la version configurada, debe mostrar una salida similar a:

```text
Using CPython 3.12.11
Creating virtual environment at: .venv
```

### 5. Verificar la version instalada

Desde `labs/`:

```powershell
.\.venv\Scripts\python.exe --version
```

La salida esperada es:

```text
Python 3.12.11
```

### 6. Validar imports del laboratorio

Desde `labs/`:

```powershell
.\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; from google import genai; print('imports ok')"
```

La salida esperada es:

```text
imports ok
```

### Nota sobre warning de hardlinks en uv

Durante `uv sync` puede aparecer un warning como:

```text
warning: Failed to hardlink files; falling back to full copy.
```

No es un error. Significa que `uv` no pudo usar hardlinks desde su cache y copio los archivos normalmente. El entorno queda funcional. Para ocultar ese warning se puede usar `--link-mode=copy`, pero no es necesario para el funcionamiento normal.

## Verificar si un paquete esta instalado

La forma mas directa es importar el paquete usando el Python del entorno virtual.

Desde la raiz del proyecto:

```powershell
.\labs\.venv\Scripts\python.exe -c "import dotenv; print(dotenv.__file__)"
```

Si el paquete esta instalado, se obtiene una ruta similar a:

```text
D:\Fuentes\Core\ai-agent-labs\labs\.venv\Lib\site-packages\dotenv\__init__.py
```

Eso confirma que el modulo `dotenv` esta disponible para ese interprete.

## Verificar varios imports

Para validar las dependencias usadas por el laboratorio de Gemini:

```powershell
.\labs\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; from google import genai; print('imports ok')"
```

Si todo esta correcto, la salida sera:

```text
imports ok
```

## Usar uv para verificar imports

Tambien se puede validar desde `labs/` usando `uv run`:

```powershell
cd labs
uv run python -c "import dotenv; print(dotenv.__file__)"
```

## Nota sobre nombres de paquetes e imports

El nombre usado para instalar un paquete no siempre coincide con el nombre usado para importarlo.

Ejemplo:

```powershell
uv add python-dotenv
```

Pero en Python se importa como:

```python
from dotenv import load_dotenv
```

## Cuando Pylance sigue mostrando warning

Si el paquete se puede importar por consola pero Pylance sigue mostrando warning, entonces el problema normalmente no es la instalacion. Las causas comunes son:

- VS Code esta usando otro interprete Python.
- Pylance conserva cache anterior.
- La ventana de VS Code necesita recargarse.

Acciones recomendadas:

1. Ejecutar `Python: Select Interpreter`.
2. Seleccionar `labs\.venv\Scripts\python.exe`.
3. Ejecutar `Developer: Reload Window`.
4. Cerrar y abrir de nuevo el archivo Python afectado.
