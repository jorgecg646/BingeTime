# 📐 Arquitectura de BingeTime

BingeTime está desarrollada utilizando las últimas convenciones de **Angular 19**, adoptando componentes standalone, inyección de dependencias funcional y estilizado utilitario con **Tailwind CSS**.

Volver al índice: [[BingeTime]].

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Framework Frontend** | Angular 19 (Standalone Components) | Arquitectura modular basada en componentes desacoplados sin NgModules. |
| **Lenguaje** | TypeScript | Tipado estricto para modelos de series, temporadas y episodios. |
| **Estilos** | Tailwind CSS v3 | Diseño responsivo oscuro tipo plataforma de streaming (Netflix/HBO). |
| **Proveedor de Datos** | API Pública TVMaze | Datos abiertos sin necesidad de API Key ni autenticación. |
| **Persistencia** | `localStorage` / IndexedDB | Almacenamiento local de las series del usuario sin requerir backend obligatorio. |
| **Hosting & CI/CD** | Netlify (`netlify.toml`) | Despliegue estático automatizado con enrutamiento SPA y cabeceras de caché. |

---

## 🧩 Principales Componentes (`src/app/components/`)

* **`counter`:** Contador sticky o prominente con el tiempo total acumulado (días, horas, minutos).
* **`search`:** Barra de búsqueda en vivo con debounce para evitar llamadas excesivas a TVMaze.
* **`show-details-modal`:** Ficha emergente con sinopsis, selector de temporadas vistas y reparto.
* **`your-shows` & `your-shows-page`:** Cuadrícula con las portadas de los shows que el usuario está siguiendo.
* **`stats-wrapped`:** Infografía interactiva estilo "Spotify Wrapped" con el resumen de maratones anuales.
* **`calendar`:** Vista cronológica de estrenos de nuevos episodios para las series que sigues.
* **`smart-recommendations`:** Motor de recomendaciones basado en géneros de las series completadas.

---

## Enlaces Relacionados
* [[Integracion-TVMaze-API]] — Capa de servicios de datos.
* [[Calculadora-de-Tiempo]] — Lógica matemática de conversión de tiempo.
