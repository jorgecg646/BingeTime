# APIs & Integrations 🌐

This document provides details on all external API contracts, in-memory caching strategies, backend serverless functions, and local API emulation.

---

## 1. TMDB API v3 Integration (`TmdbService`)

All entertainment metadata (series titles, overviews, seasons, episode counts, artwork, cast members, watch providers, videos/trailers, and reviews) originates from **The Movie Database (TMDB) API v3**.

### 1.1 Authentication & Configuration
- **Base URL:** `https://api.themoviedb.org/3` (`environment.tmdbBaseUrl`)
- **Image CDN Base URL:** `https://image.tmdb.org/t/p` (`environment.tmdbImageBaseUrl`)
- **Credentials:**
  - `tmdbApiToken`: v4 Read Access Bearer Token (preferred). Attached to requests via HTTP header:
    ```
    Authorization: Bearer <TOKEN>
    ```
  - `tmdbApiKey`: v3 API Key (fallback). Attached as query parameter: `?api_key=<KEY>`.

### 1.2 Multi-Tier In-Memory Caching
To optimize performance, avoid rate-limiting, and eliminate redundant network transfers, `TmdbService` implements multiple `Map` in-memory caches:

| Cache Name | Key Type | Cached Payload | Invalidation / Lifetime |
| :--- | :--- | :--- | :--- |
| `showDetailsCache` | `number` (show ID) | `TVShow` (with seasons, cast, trailers, watch providers, reviews) | Session memory |
| `seasonDetailsCache` | `string` (`${showId}_s${seasonNumber}`) | `SeasonDetail` (episode descriptions, stills, runtimes) | Session memory |
| `personDetailsCache` | `number` (person ID) | `PersonDetail` (biography, TV credits, social IDs) | Session memory |
| `discoverCache` | `string` (serialized filter params) | Paginated show list + total counts | Session memory |
| `trendingCache` | `TVShow[] \| null` | Top 20 trending shows of the week | Session memory |
| `recommendationsCache` | `number` (show ID) | `TVShow[]` (recommended shows) | Session memory |

### 1.3 Key API Endpoints Used

| Endpoint | Purpose | Transformation in `TmdbService` |
| :--- | :--- | :--- |
| `GET /search/tv` | Live text search | Maps results to `TVShow[]`, builds full image URLs for posters. |
| `GET /tv/{id}` | Full show details | Appends `append_to_response=credits,videos,recommendations,reviews,watch/providers,external_ids`. Filters out unreleased future seasons. |
| `GET /tv/{id}/season/{number}` | Full season episodes | Returns detailed episode lists (`EpisodeDetail[]`) with air dates and stills. |
| `GET /trending/tv/week` | Trending carousel | Formats trending weekly shows with poster paths. |
| `GET /discover/tv` | Advanced discovery | Dynamic filters: `with_genres`, `air_date.gte`/`lte`, `with_watch_providers`, `sort_by` (`popularity.desc`, `vote_average.desc`, etc.). |
| `GET /person/{id}` | Actor/Creator details | Appends `combined_credits,external_ids` for actor bio and filmography modals. |

### 1.4 Global Streaming Provider Localization
BingeTime supports **43 distinct countries** for streaming platform availability (Netflix, Disney+, Max, Prime Video, Apple TV+, Movistar+, etc.):
- `SUPPORTED_COUNTRIES` in `TmdbService` defines ISO 3166-1 alpha-2 codes (e.g. `ES`, `US`, `MX`, `AR`, `GB`, `DE`).
- Users select their region via `RegionModalComponent`; the selection is persisted in `localStorage` under `selectedCountry` (defaults to `ES` if unspecified).
- TMDB watch providers are extracted per country:
  ```typescript
  const countryProviders = tmdbData['watch/providers']?.results?.[currentCountry]?.flatrate || [];
  ```

---

## 2. Serverless Cloud Persistence (`netlify/functions/shows.js`)

A single unified Netlify Function handles cloud synchronization for authenticated users, connecting to **Neon Serverless Postgres** via `@neondatabase/serverless`.

### 2.1 Route Mapping
- **Production URL:** `/.netlify/functions/shows`
- **Rewritten URL:** `/api/shows` (configured in `src/_redirects`)

### 2.2 Security & Authentication
Requests to `/api/shows` must include an `Authorization` header containing the user's Netlify Identity JWT:
```
Authorization: Bearer <NETLIFY_IDENTITY_JWT>
```
Netlify validates the JWT and injects the user context into `context.clientContext.user`:
```javascript
const { user } = context.clientContext || {};
if (!user) {
  return sendResponse(401, { error: 'Unauthorized' });
}
const userId = user.sub; // Netlify user UUID
```

### 2.3 Database Schema (PostgreSQL on Neon)

```sql
-- Watched shows table
CREATE TABLE IF NOT EXISTS watched_shows (
  user_id VARCHAR(64) NOT NULL,
  instance_id VARCHAR(128) NOT NULL,
  show_id INTEGER NOT NULL,
  show_data JSONB NOT NULL,
  seasons_watched INTEGER NOT NULL DEFAULT 1,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  episodes_watched INTEGER NOT NULL DEFAULT 0,
  user_rating INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, instance_id)
);

-- Pending / Watch Later shows table
CREATE TABLE IF NOT EXISTS pending_shows (
  user_id VARCHAR(64) NOT NULL,
  pending_id VARCHAR(128) NOT NULL,
  show_id INTEGER NOT NULL,
  show_data JSONB NOT NULL,
  added_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, pending_id)
);
```

### 2.4 API Operations Contract

#### 1. Fetch All Shows: `GET /api/shows`
- Returns all watched and pending records for the authenticated user.
- **Response `200 OK`:**
  ```json
  {
    "watched": [
      {
        "instanceId": "1399_1710000000000_abc12",
        "show": { "id": 1399, "name": "Game of Thrones", ... },
        "seasonsWatched": 8,
        "totalMinutes": 4380,
        "episodesWatched": 73,
        "userRating": 9,
        "addedAt": 1710000000000
      }
    ],
    "pending": [
      {
        "id": "63333_p_1710005000000",
        "show": { "id": 63333, "name": "The Last of Us", ... },
        "addedAt": 1710005000000
      }
    ]
  }
  ```

#### 2. Upsert Show: `POST /api/shows`
- **Request Body (Watched):**
  ```json
  {
    "type": "watched",
    "item": { "instanceId": "...", "show": { ... }, "seasonsWatched": 2, "totalMinutes": 1200, "episodesWatched": 20, "userRating": 8, "addedAt": 1710000000000 }
  }
  ```
- **Request Body (Pending):**
  ```json
  {
    "type": "pending",
    "item": { "id": "...", "show": { ... }, "addedAt": 1710000000000 }
  }
  ```
- Uses PostgreSQL `ON CONFLICT (...) DO UPDATE` for idempotent upserts.

#### 3. Delete Show: `POST /api/shows` (or `DELETE`)
- Supports delete via `POST` with `action: 'delete'` to bypass strict firewalls/proxies that block request bodies on HTTP `DELETE`:
  ```json
  {
    "action": "delete",
    "type": "watched",
    "instanceId": "1399_1710000000000_abc12"
  }
  ```

#### 4. Reset Account Data: `POST /api/shows`
- Permanently deletes all rows for the user:
  ```json
  { "action": "reset" }
  ```

### 2.5 Request Safeguards
- `POST` and `DELETE` request bodies are limited to 256 KiB. Invalid JSON, unsupported actions, invalid identifiers, and out-of-range season/episode counts return `400` before database access.
- Watched ratings are clamped to `0–10`. Stored show metadata is restricted to known display and season fields; arbitrary nested TMDB response data is discarded.
- CORS allows the configured Netlify `URL`, `https://bingetimes.netlify.app`, and the local dev origins `http://localhost:3000` and `http://127.0.0.1:3000`. Unapproved preflight requests receive `403`.
- Authenticated requests are limited to 300 per user per rolling minute per warm function instance. Excess requests receive `429 Too Many Requests` with `Retry-After`. Netlify function instances do not share memory, so a shared rate-limit store is needed for globally coordinated limits across concurrent instances.
- Unexpected server errors return a generic `500` message; technical details are logged server-side only.

---

## 3. Local Development Simulation (`local-api-server.js`)

In local development, the Netlify Functions runtime is simulated using a lightweight Node.js HTTP server on port **8888**:

1. **Loads `.env.local`:** Reads `DATABASE_URL=postgresql://...`.
2. **Decodes JWT:** Decodes the Netlify Identity JWT sent in `Authorization: Bearer <token>` without verifying cryptographic signatures, populating `context.clientContext.user` for development ease.
3. **Executes Handlers:** Calls the exact same `handler` exported by `netlify/functions/shows.js`.
4. **Proxying:** `src/proxy.conf.json` maps frontend `/api` requests to `http://localhost:8888` and `/.netlify/identity` to `https://bingetimes.netlify.app`.
