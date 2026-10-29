# BingeTime Documentation 📚

Welcome to the comprehensive technical documentation for **BingeTime** (TV Time Calculator).

This documentation is designed to provide full context, architectural clarity, and development guidelines for both **human developers** and **AI coding assistants** (Gemini, Claude, GPT, Cursor, Copilot, etc.).

---

## 📑 Documentation Index

| Document | Description |
| :--- | :--- |
| **[AI Agent Guide](AI_AGENT_GUIDE.md)** | **Essential reading for AI assistants.** Mental model, critical gotchas, code conventions, and step-by-step implementation playbooks. |
| **[System Architecture](ARCHITECTURE.md)** | High-level system design, technology stack, layer separation, standalone components, and signal architecture. |
| **[State Management & Sync](STATE_AND_SYNC.md)** | Reactive state (`ShowStateService`), offline-first `localStorage`, cloud sync with Neon Postgres, conflict resolution, and TVMaze-to-TMDB migration. |
| **[APIs & Integrations](API_AND_INTEGRATIONS.md)** | TMDB v3 API consumption, in-memory caching, Netlify Functions (`/api/shows`), Netlify Identity auth (GoTrue), and local server simulation. |
| **[Components & Routing](COMPONENTS_AND_ROUTING.md)** | Route registry, lazy loading, guest guard, complete component catalog, modals, and user interaction flows. |
| **[Development & Testing](DEVELOPMENT_AND_TESTING.md)** | Local environment setup, environment variable generator (`set-env.js`), build pipeline, PWA service worker, and Karma/Jasmine testing suite. |

---

## 🚀 Quick Orientation

- **What is BingeTime?**
  A modern Single Page Application (SPA) built with Angular 19 that allows users to track TV series, automatically calculate watch time (days, hours, minutes), manage pending watchlists, explore ratings, discover trending shows via TMDB, view upcoming releases on a calendar, and generate personalized binge-watching statistics.

- **Core Tech Stack:**
  - **Frontend:** Angular 19 (Standalone Components, Signals, `inject()`, Control Flow `@if`/`@for`), Tailwind CSS 3, RxJS 7.
  - **Backend / Serverless:** Netlify Functions (Node.js), `@neondatabase/serverless` (Neon Postgres).
  - **Authentication:** Netlify Identity (`gotrue-js`).
  - **Data Providers:** The Movie Database (TMDB) API v3.
  - **Packaging & Tooling:** `pnpm`, Angular CLI 19, Karma/Jasmine.

- **Key Entry Points:**
  - `src/main.ts`: Application bootstrap with `provideHttpClient()`, `provideRouter()`, and `provideServiceWorker()`.
  - `src/app/app.routes.ts`: Route declarations with lazy loading.
  - `src/app/services/show-state.service.ts`: Core state management and business logic.
  - `src/app/services/tmdb.service.ts`: TMDB API client with caching.
  - `netlify/functions/shows.js`: Serverless API for user cloud data persistence.

