# Development & Testing 🛠️

This document outlines environment configuration, local development commands, the build pipeline, PWA setup, and automated testing procedures for **BingeTime**.

---

## 1. Prerequisites & Installation

- **Node.js:** v18.x or v20.x recommended
- **Package Manager:** `pnpm` (v9+)

Install dependencies:
```bash
pnpm install
```

---

## 2. Environment Configuration

BingeTime uses `set-env.js` to dynamically generate Angular environment files (`src/environments/environment.ts` and `src/environments/environment.prod.ts`) before any serve or build command.

### 2.1 Configuration Files

```
BingeTime/
├── .env                  # Read by set-env.js for TMDB credentials
├── .env.local            # Read by local-api-server.js for DATABASE_URL
└── src/environments/
    ├── environment.ts    # Generated dev configuration (git-ignored)
    └── environment.prod.ts # Generated production configuration (git-ignored)
```

### 2.2 Environment Variables

| Variable | Target File | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `TMDB_API_READ` (or `TMDB_TOKEN`) | `.env` | TMDB v4 Read Access Token (Bearer) | `eyJhbGciOiJIUzI1NiJ9...` |
| `TMDB_API_KEY` (or `TMDB_KEY`) | `.env` | TMDB v3 API Key (query parameter fallback) | `a1b2c3d4...` |
| `DATABASE_URL` | `.env.local` | PostgreSQL connection string for Neon database | `postgresql://user:pass@ep-xyz.neon.tech/bingetime?sslmode=require` |
| `NETLIFY_URL` | Netlify env / `.env` | Netlify deployment URL for Identity | `https://bingetimes.netlify.app` |

---

## 3. Running Locally

### Option A: Frontend Only (Mocked/Local Storage Mode)
If you only need to work on the UI, search, or TMDB features without syncing to a cloud database:
```bash
pnpm run dev
```
- Starts Angular dev server at `http://localhost:3000`.
- All watchlist and pending show actions persist strictly to browser `localStorage`.

### Option B: Full Stack (Frontend + Local Serverless API)
To test cloud synchronization with Neon Postgres locally:
1. Ensure `.env.local` contains a valid `DATABASE_URL`.
2. Start the local Netlify function emulation server in Terminal 1:
   ```bash
   pnpm run dev:api
   ```
   *Runs `local-api-server.js` on port `8888`.*
3. Start the Angular dev server in Terminal 2:
   ```bash
   pnpm run dev
   ```
   *`proxy.conf.json` automatically proxies `/api` requests to `http://localhost:8888`.*

---

## 4. Production Build & PWA

### Build Command
```bash
pnpm run build
```
This executes:
1. `node set-env.js`: Generates `src/environments/environment.prod.ts` with production tokens.
2. `ng build`: Compiles production bundles into `dist/`.

### PWA Configuration (`ngsw-config.json`)
- **App Shell Cache:** Pre-caches `index.html`, `manifest.webmanifest`, CSS, JS bundles, and favicon.
- **Asset Cache:** Lazy-caches `/icons/`, font files, and image assets (`.png`, `.webp`, `.svg`, `.avif`).
- Registered in `src/main.ts` using `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() })`.

---

## 5. Automated Testing (Karma & Jasmine)

Run the automated test suite:
```bash
pnpm test
```
*Executes `ng test --watch=false` in headless Chrome.*

Run focused tests for the Netlify cloud-sync function:
```bash
pnpm run test:api
```
*Uses Node's built-in test runner to check request validation, authentication, metadata sanitation, CORS, error responses, and rate limiting without connecting to Neon.*

### Existing Test Coverage

1. **`ShowStateService` Specs (`src/app/services/show-state.service.spec.ts`)**:
   - Adding watched shows and calculating episode/minute totals.
   - Incrementing and decrementing seasons.
   - Marking shows as pending and moving them to watched.
   - Rating shows and verifying storage updates.
   - Non-blocking cloud synchronization errors (`syncError` signal).
   - Timestamp recovery from `instanceId` format.
2. **`AuthService` Specs (`src/app/services/auth.service.spec.ts`)**:
   - Session restoration from `localStorage`.
   - Proactive JWT token expiration check and refresh scheduling.
   - User display name derivation from email or OAuth metadata.
3. **`TmdbService` Specs (`src/app/services/tmdb.service.spec.ts`)**:
   - Search request formatting and query encoding.
   - In-memory cache hits on repeated `getShowDetails` calls.
   - Correct country-based provider filtering.

### Guidelines for Writing Tests
- **Mock external dependencies:** Use Jasmine spies (`jasmine.createSpy()`) or value mocks rather than real HTTP calls.
- **Clear storage:** Clear `localStorage.clear()` in `beforeEach` to guarantee test isolation.
- **Assert behavior, not implementation details:** Assert changes in signals (`service.watchedShows().length`, `service.totalMinutes()`) rather than internal private variables.
