# 🤖 Flujo de Trabajo con Obsidian Canvas y Agentes IA

En **BingeTime**, la planificación y ejecución de mejoras se gestiona a través de un tablero visual **Obsidian Canvas** ([[Project.canvas]]) y el CLI `canvas-tool.py`.

Volver al índice: [[BingeTime]].

---

## 🚦 Código de Colores

| Color | Significado | ¿Quién lo cambia? |
| :--- | :--- | :--- |
| **Morado** (`"6"`) | **Propuesta:** Tarea sugerida por un agente IA. | Agente (`propose` / `batch`) |
| **Rojo** (`"1"`) | **Por hacer:** Aprobada y lista para ser ejecutada. | Humano o herramienta automática |
| **Naranja** (`"2"`) | **En curso:** Tarea en ejecución activa. | Agente (`start`) |
| **Cian** (`"5"`) | **Para revisar:** Lista para verificación humana. | Agente (`finish`) |
| **Verde** (`"4"`) | **Completado:** Verificado y cerrado. | **Exclusivamente el Humano** |
| **Gris** (`"0"`) | **Bloqueado:** Esperando dependencias. | Herramienta automática |

---

## 📂 Archivos del Sistema
* [[Project.canvas]]: El lienzo interactivo de tareas.
* [[AGENTS]]: Instrucciones para agentes de IA.
* [[RULES]]: Reglas del flujo de trabajo y estados.
* [[CLAUDE]]: Adaptación de directivas para Claude.

---

## Enlaces Relacionados
* [[BingeTime]] — Índice central del proyecto.
* [[Arquitectura]] — Módulos técnicos.
