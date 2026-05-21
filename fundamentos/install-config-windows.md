# Configuración del entorno en Windows usando VSCode y UV

> Guía adaptada para trabajar con **VSCode** como IDE principal.  
> El curso usa **Cursor** como referencia, pero Cursor está basado en VSCode y el flujo puede realizarse correctamente desde VSCode.

## 1. Requisitos previos

Antes de comenzar, asegúrate de tener instalado:

- Git
- VSCode
- Python
- UV
- Extensiones de VSCode para Python y Jupyter
- Microsoft Build Tools, si vas a trabajar con paquetes que requieren compilación nativa

## 2. Instalar Git

- Descarga [Git para Windows](https://git-scm.com/download/win) desde:
- Verifica la instalación:

```bash
git --version
```

## 3. Seleccionar directorio del proyecto

Puedes abrir con `Explorador`, `PowerShell` o `CMD`.

- Si usas `PowerShell` o `CMD` ingresa al directorio y ejecuta desde la terminal (abrir el proyecto en VSCode):

```bash
code .
```

- `Explorador` (manualmente):

```txt
VSCode → File → Open Folder → seleccionar carpeta agents
```

## 4. Instalar extensiones necesarias en VSCode

Instala estas extensiones:

- Python
- Jupyter

Desde VSCode:

```txt
Extensions → Buscar "Python" → Instalar extensión oficial de Microsoft
Extensions → Buscar "Jupyter" → Instalar extensión oficial de Microsoft
```

**NOTA IMPORTANTE**:

- Verificar que `Publisher`: `Microsoft`

## 5. Instalar UV

Instala UV siguiendo la documentación oficial:

```txt
https://docs.astral.sh/uv/getting-started/installation/
```

En Windows, puedes usar PowerShell:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Cierra y vuelve a abrir la terminal.

Verifica la instalación:

```bash
uv --version
```

Actualiza UV:

```bash
uv self update
```

**NOTA IMPORTANTE**:

`UV` es una herramienta moderna para:

- gestionar entornos virtuales,
- instalar paquetes,
- manejar dependencias,
- ejecutar proyectos,
- administrar versiones de Python.

## 6. Desactivar Conda si lo usas

Si tienes Anaconda o Miniconda instalado, desactiva el entorno activo:

```bash
conda deactivate
```

Opcionalmente, evita que Conda active automáticamente el entorno base:

```bash
conda config --set auto_activate_base false
```

## 7. Instalar dependencias del proyecto con UV

Desde la raíz del proyecto:

```bash
uv sync
```

Si aparece un error relacionado con certificados, prueba:

```bash
uv --native-tls sync
```

Si el problema continúa:

```bash
uv --allow-insecure-host github.com sync
```

**NOTA IMPORTANTE**

`uv sync` debe ejecutarse desde la raíz de un proyecto Python que contenga un archivo:

```txt
pyproject.toml
```

Por ejemplo:

```bash
cd D:\Fuentes\Core\ai-agent-labs
```

## 8. Inicializar un proyecto UV (opcional)

Si el repositorio todavía no contiene un archivo:

```txt
pyproject.toml
```

significa que aún no ha sido inicializado como proyecto Python administrado por UV.

En ese caso, puedes inicializarlo manualmente.

### Paso 1 — Abrir terminal en la raíz del proyecto

Ejemplo:

```bash
cd D:\Fuentes\Core\ai-agent-labs
```

### Paso 2 — Inicializar UV

```bash
uv init
```

Esto creará archivos como:

```txt
pyproject.toml
.python-version
README.md
```

### Paso 3 — Crear entorno virtual

```bash
uv venv
```

### Paso 4 — Instalar dependencias iniciales

Ejemplo:

```bash
uv add openai
uv add jupyter
uv add ipykernel
```

### Resultado esperado

La estructura del proyecto será similar a:

```txt
ai-agent-labs
├── .venv
├── pyproject.toml
├── uv.lock
├── README.md
```

> NOTA: este paso es necesario únicamente cuando el repositorio aún no contiene configuración Python basada en UV.

## 9. Instalar CrewAI como herramienta global de UV

Este paso será útil para los módulos relacionados con CrewAI.

```bash
uv tool install crewai
uv tool upgrade crewai
```

## 10. Crear archivo `.env`

En la raíz del proyecto, crea un archivo llamado exactamente:

```txt
.env
```

No debe llamarse:

```txt
env
env.txt
.env.txt
```

Debe llamarse únicamente:

```txt
.env
```

Puedes crearlo desde la terminal:

```bash
type nul > .env
```

O desde VSCode:

```txt
File → New File → guardar como .env en la raíz del proyecto
```

## 11. Configurar API keys

Dentro del archivo `.env`, agrega tus claves:

```env
OPENAI_API_KEY=tu_api_key_aqui
GOOGLE_API_KEY=tu_api_key_aqui
ANTHROPIC_API_KEY=tu_api_key_aqui
DEEPSEEK_API_KEY=tu_api_key_aqui
```

La clave más importante para iniciar normalmente será:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
```

> Importante: no subas el archivo `.env` a GitHub.

Verifica que exista `.gitignore` y que incluya:

```gitignore
.env
.venv
```

## 12. Seleccionar el intérprete de Python en VSCode

Después de ejecutar `uv sync`, UV debería crear un entorno virtual `.venv`.

En VSCode:

```txt
Ctrl + Shift + P
Python: Select Interpreter
Seleccionar .venv
```

También puedes buscar una ruta similar a:

```txt
./.venv/Scripts/python.exe
```

## 13. Abrir notebooks del curso

Abre el primer laboratorio, por ejemplo:

```txt
1_foundations/1_lab1.ipynb
```

En la parte superior derecha del notebook:

```txt
Select Kernel → Python Environments → .venv
```

Luego ejecuta una celda con:

```txt
Shift + Enter
```

## 14. Comandos útiles durante el curso

Ejecutar un archivo Python:

```bash
uv run python main.py
```

Agregar una dependencia:

```bash
uv add nombre-paquete
```

Eliminar una dependencia:

```bash
uv remove nombre-paquete
```

Sincronizar dependencias:

```bash
uv sync
```

Actualizar lockfile:

```bash
uv lock
```

Ver paquetes instalados:

```bash
uv pip list
```

## 15. Cursor vs VSCode

El curso usa Cursor como IDE de referencia, pero no es obligatorio usarlo.

Cursor es un editor basado en VSCode con funciones integradas de IA. Sin embargo, para seguir el curso puedes trabajar con:

```txt
VSCode + Python Extension + Jupyter Extension + UV
```

Esto es suficiente para ejecutar notebooks, gestionar entornos virtuales y trabajar con el código del curso.

## 16. Recomendación personal de entorno

Para mantener un flujo estable y profesional:

```txt
IDE principal: VSCode
Gestor de entorno y paquetes: UV
Terminal: PowerShell o terminal integrada de VSCode
Notebooks: Jupyter extension
Control de versiones: Git
```

Cursor puede instalarse opcionalmente para comparar su experiencia con IA, pero no es necesario reemplazar VSCode.

## 17. Checklist final

- [ ] Git instalado
- [ ] VSCode instalado
- [ ] Extensión Python instalada
- [ ] Extensión Jupyter instalada
- [ ] UV instalado
- [ ] Repositorio clonado
- [ ] Proyecto abierto en VSCode
- [ ] `uv sync` ejecutado correctamente
- [ ] `.venv` seleccionado como intérprete
- [ ] Archivo `.env` creado
- [ ] API keys configuradas si aplica
- [ ] Primer notebook ejecutado correctamente

[REGRESAR](./README.md)
