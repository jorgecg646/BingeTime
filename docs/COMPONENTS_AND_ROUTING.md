# Components & Routing 🧭

This document provides a catalog of all Angular components, route declarations, navigation behavior, and UI modal flows.

---

## 1. Routing Architecture (`src/app/app.routes.ts`)

BingeTime uses Angular 19 route-level code splitting with `loadComponent()`:

```typescript
export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./components/your-shows-page/your-shows-page.component')
      .then(m => m.YourShowsPageComponent) 
  },
  { 
    path: 'discover', 
    loadComponent: () => import('./components/home/home.component')
      .then(m => m.HomeComponent) 
  },
  { 
    path: 'top-series', 
    loadComponent: () => import('./components/top-series/top-series.component')
      .then(m => m.TopSeriesComponent) 
  },
  { 
    path: 'calendar', 
    loadComponent: () => import('./components/calendar/calendar.component')
      .then(m => m.CalendarComponent) 
  },
  { 
    path: 'stats', 
    loadComponent: () => import('./components/stats-wrapped/stats-wrapped.component')
      .then(m => m.StatsWrappedComponent) 
  },
  { path: 'wrapped', redirectTo: 'stats' },
  { 
    path: 'auth', 
    loadComponent: () => import('./components/auth/auth.component')
      .then(m => m.AuthComponent), 
    canActivate: [guestGuard] 
  },
  { path: '**', redirectTo: '' }
];
```

### Route Guards (`src/app/guards/auth.guard.ts`)
- **`guestGuard`**: Prevents already-authenticated users from navigating to `/auth`. If `AuthService.isLoggedIn()` is true, they are redirected to `/`.

---

## 2. Component Catalog

### 2.1 Shell & Global UI

#### `AppComponent` (`src/app/app.component.ts`)
- **Role:** Application root shell containing navigation, footer, dynamic background artwork, and global modal overlays.
- **Scroll Detection:** Implements a `@HostListener('window:scroll')` handler that hides the floating top navigation bar when scrolling down and restores it when scrolling up.
- **Dynamic Background Artwork:** Cycles through high-definition 16:9 backdrops from the user's watched shows, fading smoothly between posters/backdrops.
- **Global Modals Attached:**
  - `<app-show-details-modal>`
  - `<app-person-modal>`
  - `<app-region-modal>`

#### `AdsenseComponent` (`src/app/components/adsense/`)
- Encapsulates Google AdSense responsive ad units.
- Injects `adsbygoogle.js` on demand and safely triggers `(window.adsbygoogle = window.adsbygoogle || []).push({})`.

---

### 2.2 Main Page Views

#### `YourShowsPageComponent` (`src/app/components/your-shows-page/`)
- **Route:** `/`
- **Features:**
  - Embeds `<app-counter>` to present real-time total watch duration (days, hours, minutes).
  - Displays new episode notifications banner when alerts are present in `ShowStateService.newEpisodeAlerts()`.
  - Embeds `<app-your-shows>` for managing watched series (incrementing seasons, removing, changing personal 1-10 rating).
  - Embeds `<app-pending-shows>` displaying the user's "Watch Later" queue.

#### `HomeComponent` (`src/app/components/home/`)
- **Route:** `/discover`
- **Features:**
  - Live search input powered by `<app-search>`.
  - Filter drawer: Genre multi-select (`ALL_GENRES`), Decade filter (`2020s`, `2010s`, `Pre-80s`), Streaming Provider filter (`POPULAR_PROVIDERS`), and sorting criteria (`Popularity`, `Rating`, `Newest`).
  - Embeds `<app-trending>` showing top trending weekly series.
  - Infinite scroll / paginated grid of discovered shows.
  - Action buttons on show cards: Quick add to watched, add to pending, open details modal.

#### `TopSeriesComponent` (`src/app/components/top-series/`)
- **Route:** `/top-series`
- **Features:**
  - Displays the Top 250 rated TV series of all time according to TMDB votes.
  - Each item displays its rank badge (`#1` to `#250`), TMDB community score, release year, genres, and quick action buttons.

#### `CalendarComponent` (`src/app/components/calendar/`)
- **Route:** `/calendar`
- **Features:**
  - Displays a release schedule of upcoming and recently aired episodes.
  - Highlights episodes belonging to shows in the user's watchlist (`isUserShow = true`).
  - Provides date filters (Today, This Week, This Month).

#### `StatsWrappedComponent` (`src/app/components/stats-wrapped/`)
- **Route:** `/stats` (also `/wrapped`)
- **Features:**
  - "Spotify Wrapped"-style presentation of user viewing habits.
  - Highlights top 3 genres, total days/hours spent, longest series completed, average user rating, and total episodes watched.
  - Clean card layouts with shareable statistics.

#### `AuthComponent` (`src/app/components/auth/`)
- **Route:** `/auth`
- **Features:**
  - Email/password sign in and sign up.
  - Google OAuth one-click login (redirects to Netlify Identity provider).
  - Password recovery workflow.

---

### 2.3 Feature & Widget Components

#### `CounterComponent` (`src/app/components/counter/`)
- Displays prominent animated digital counters: Days, Hours, Minutes, and Total Episodes.
- Synchronized directly to `state.days()`, `state.hours()`, `state.minutes()`, and `state.totalEpisodes()`.

#### `SearchComponent` (`src/app/components/search/`)
- Provides debounced search (300ms) against `TmdbService.searchShows()`.
- Dropdown autocomplete showing poster thumbnails, release year, and genre tags.

#### `YourShowsComponent` & `PendingShowsComponent`
- Display interactive show lists with responsive grid and list layouts.
- Quick controls:
  - Season stepper: `[-] 3/5 [+]` (cannot increment beyond aired seasons).
  - Star rating: 1 to 10 stars (stored in `userRating`).
  - Delete with confirmation.
  - Move from Pending to Watched.

---

### 2.4 Modals & Overlays

#### `ShowDetailsModalComponent` (`src/app/components/show-details-modal/`)
- Triggered by `state.openDetails(show)` or URL query parameter `?show=<id>`.
- **Contains:**
  - Backdrop banner with trailer video playback (embedded YouTube player via `VideoTrailer`).
  - Overview synopsis, production status, network logos, and genre badges.
  - Available streaming platforms for the currently selected country.
  - Interactive season and episode list browser (`SeasonDetail` and `EpisodeDetail`).
  - Full cast carousel; clicking an actor opens `PersonModalComponent`.
  - TMDB community reviews.
  - Recommended similar shows.
  - "Add to Watched" season-picker modal transition.

#### `PersonModalComponent` (`src/app/components/person-modal/`)
- Triggered by `tmdb.activePersonModalId`.
- Fetches detailed biography, place of birth, birthday, social links (IMDb, Instagram, Twitter), and filmography with TV show credits.

#### `RegionModalComponent` (`src/app/components/region-modal/`)
- Triggered by clicking the country flag in the navigation bar or footer.
- Allows the user to select from 43 supported countries to localize streaming provider badges.

