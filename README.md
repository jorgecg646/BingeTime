# BingeTime 📺

**BingeTime** (TV Time Calculator) es una aplicación web moderna diseñada para registrar, calcular y hacer seguimiento del tiempo total que has dedicado a ver tus series de televisión favoritas. Construida con **Angular 19** y estilizada de forma interactiva con **Tailwind CSS**, utiliza la API pública de **The Movie Database (TMDB)** para obtener datos en tiempo real de miles de shows, posters, trailers, calendarios y plataformas de streaming.

---

## 📚 Documentación Técnica & AI Guide

Para conocer la arquitectura detallada, el flujo de sincronización y las guías para agentes de IA:

- **[Guía para Agentes de IA](docs/AI_AGENT_GUIDE.md)**: Modelo mental, 7 gotchas críticos y recetas de implementación.
- **[Arquitectura del Sistema](docs/ARCHITECTURE.md)**: Diseño Angular 19 standalone, signals y estructura de capas.
- **[Estado y Sincronización](docs/STATE_AND_SYNC.md)**: Offline-first (`localStorage`) y sincronización en la nube con Neon Postgres.
- **[APIs e Integraciones](docs/API_AND_INTEGRATIONS.md)**: TMDB v3 API, Netlify Functions (`/api/shows`) y servidor local.
- **[Componentes y Rutas](docs/COMPONENTS_AND_ROUTING.md)**: Catálogo de componentes, modales y navegación.
- **[Desarrollo y Pruebas](docs/DEVELOPMENT_AND_TESTING.md)**: Variables de entorno, `set-env.js`, PWA y suite de tests Karma/Jasmine.
- **[Índice Completo de Documentación](docs/README.md)**

---

## ✨ Características

- **Búsqueda Avanzada**: Busca cualquier serie de televisión en tiempo real gracias a la API de TVMaze.
- **Calculadora de Tiempo**: Calcula automáticamente los minutos, horas y días totales invertidos en cada serie según las temporadas y episodios que hayas visto.
- **Seguimiento Personalizado**: Lleva un control preciso indicando cuántas temporadas o episodios específicos has visualizado.
- **Calificación**: Asigna tu propia valoración (rating) personal a cada show visto.
- **Persistencia Local**: Guarda de forma local tu biblioteca de series para que nunca pierdas tu progreso.
- **Diseño Adaptable (Responsive)**: Interfaz intuitiva y moderna optimizada tanto para móviles como para ordenadores de escritorio.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: [Angular v19](https://angular.dev/)
- **Estilos**: [Tailwind CSS v3](https://tailwindcss.com/)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **API**: [The Movie Database (TMDB) API](https://developer.themoviedb.org/) (con soporte de migración legacy para TVMaze)
- **Gestor de Paquetes**: [pnpm](https://pnpm.io/)

---

## 🚀 Comenzar (Desarrollo Local)

Sigue estos pasos para levantar el entorno de desarrollo local:

### Requisitos Previos

Asegúrate de tener instalado [Node.js](https://nodejs.org/) y el gestor de paquetes `pnpm`. Si no tienes `pnpm`, puedes instalarlo con:
```bash
npm install -g pnpm
```

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone <url-del-repositorio>
cd BingeTime
pnpm install
```

### 2. Ejecutar el servidor de desarrollo

Ejecuta el siguiente comando para iniciar el servidor de desarrollo local:

```bash
pnpm run dev
```

El servidor web estará disponible por defecto en `http://localhost:3000`.

---

## 📦 Producción y Compilación

Para compilar el proyecto y prepararlo para producción:

```bash
pnpm run build
```

El resultado de la compilación se generará en el directorio `/dist/`.