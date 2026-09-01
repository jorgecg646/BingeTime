import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { forkJoin, of, Observable } from 'rxjs';
import { TVShow, WatchedShow, PendingShow, NewEpisodeAlert, NewEpisodeInfo } from '../models';
import { TmdbService } from './tmdb.service';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ShowStateService {
  private tmdb = inject(TmdbService);
  private auth = inject(AuthService);
  private supabaseService = inject(SupabaseService);

  /** Reactive list of all shows the user has watched. Persisted in localStorage. */
  watchedShows = signal<WatchedShow[]>(this.loadFromStorage());
  /** Reactive list of shows saved to watch later. Persisted in localStorage. */
  pendingShows = signal<PendingShow[]>(this.loadPendingFromStorage());

  /** Alerts for shows in the watchlist that have new episodes in the last 2 weeks. */
  newEpisodeAlerts = signal<NewEpisodeAlert[]>(this.loadAlertsFromStorage());
  /** Whether a background check for new episodes is currently in progress. */
  checkingForUpdates = signal<boolean>(false);
  /**
   * True while a background sync with Neon is in progress.
   * localStorage data is shown immediately; this flag can drive a subtle UI indicator.
   */
  isSyncingFromNeon = signal<boolean>(false);

  /** The show currently displayed in the details modal, or null if closed. */
  activeShowForDetails = signal<TVShow | null>(null);
  /** The show currently selected in the season-picker modal, or null if closed. */
  selectedShow = signal<TVShow | null>(null);
  /** Number of seasons selected in the season-picker modal. */
  seasonsToAdd = signal<number>(0);
  /** Error/warning message when user attempts to add an unreleased season. */
  seasonWarning = signal<string | null>(null);

  constructor() {
    // Listen for authentication changes to synchronize shows.
    // We also read isRestoringSession() so that this effect re-runs once the
    // JWT refresh is complete — ensuring we never call Neon with a stale token.
    effect(() => {
      const isRestoring = this.auth.isRestoringSession();
      const user = this.auth.user();

      if (isRestoring) {
        // Session is being restored; wait for the token refresh to finish.
        return;
      }

      if (user) {
        this.loadUserDataFromNeon(user.id);
      } else {
        this.watchedShows.set(this.loadFromStorage());
        this.pendingShows.set(this.loadPendingFromStorage());
        this.autoMigrateLegacyShows();
      }
    });
  }

  private async loadUserDataFromNeon(userId: string) {
    this.isSyncingFromNeon.set(true);
    try {
      const { watched: remoteWatched, pending: remotePending } =
        await this.supabaseService.getAllShows(userId);

      const localWatched = this.loadFromStorage();
      const localPending = this.loadPendingFromStorage();

      // --- Watched shows ---
      // Only migrate local→server when the server has ZERO records (true first login).
      // In all other cases the server is the source of truth.
      if (remoteWatched.length === 0 && localWatched.length > 0) {
        for (const item of localWatched) {
          await this.supabaseService.upsertWatchedShow(userId, item);
        }
        this.watchedShows.set(localWatched); // already sorted by loadFromStorage
      } else {
        // Server always wins — this is what makes cross-device sync work.
        this.watchedShows.set(this.sortByAddedAt(remoteWatched));
      }

      // --- Pending shows ---
      if (remotePending.length === 0 && localPending.length > 0) {
        for (const item of localPending) {
          await this.supabaseService.upsertPendingShow(userId, item);
        }
        this.pendingShows.set(localPending);
      } else {
        // Server always wins.
        this.pendingShows.set(remotePending);
      }

      // Persist the fresh server data to localStorage so the next page visit
      // can show it instantly as a cache while the background sync runs.
      localStorage.setItem('watchedShows', JSON.stringify(this.watchedShows()));
      localStorage.setItem('pendingShows', JSON.stringify(this.pendingShows()));
      this.autoMigrateLegacyShows();
    } catch (err) {
      console.error('Error loading user data from Neon:', err);
      // Falls back to localStorage data already shown on screen — no disruption.
    } finally {
      this.isSyncingFromNeon.set(false);
    }
  }

  /**
   * Helper to verify if two show titles are the same show (handles punctuation, accents, casing).
   */
  private isNameMatching(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const c1 = clean(name1);
    const c2 = clean(name2);
    return c1 === c2 || c1.includes(c2) || c2.includes(c1);
  }

  /**
   * Migrates a legacy TVMaze show to its official TMDB show record across watched and pending lists.
   */
  private migrateShowInState(oldId: number, newShow: TVShow): void {
    const user = this.auth.user();

    // Update in watched shows
    this.watchedShows.update(list =>
      list.map(item => {
        if (item.show.id === oldId || this.isNameMatching(item.show.name, newShow.name)) {
          const updatedItem: WatchedShow = {
            ...item,
            show: {
              ...newShow,
              seasons: newShow.seasons && newShow.seasons.length > 0 ? newShow.seasons : item.show.seasons
            }
          };
          if (user) {
            this.supabaseService.upsertWatchedShow(user.id, updatedItem).catch(err =>
              console.error('Error syncing migrated watched show to server:', err)
            );
          }
          return updatedItem;
        }
        return item;
      })
    );
    this.save();

    // Update in pending shows
    this.pendingShows.update(list =>
      list.map(item => {
        if (item.show.id === oldId || this.isNameMatching(item.show.name, newShow.name)) {
          const updatedPending: PendingShow = {
            ...item,
            show: newShow
          };
          if (user) {
            this.supabaseService.upsertPendingShow(user.id, updatedPending).catch(err =>
              console.error('Error syncing migrated pending show to server:', err)
            );
          }
          return updatedPending;
        }
        return item;
      })
    );
    this.savePending();
  }

  /**
   * Scans existing shows for legacy TVMaze entries and automatically converts them to TMDB.
   */
  private autoMigrateLegacyShows(): void {
    const legacyWatched = this.watchedShows().filter(w => w.show.poster_path?.includes('tvmaze.com'));
    for (const w of legacyWatched) {
      this.tmdb.searchShows(w.show.name).subscribe(results => {
        const match = results.find(s => this.isNameMatching(s.name, w.show.name)) || results[0];
        if (match) {
          this.tmdb.getShowDetails(match.id).subscribe(detailed => {
            if (detailed) {
              this.migrateShowInState(w.show.id, detailed);
            }
          });
        }
      });
    }

    const legacyPending = this.pendingShows().filter(p => p.show.poster_path?.includes('tvmaze.com'));
    for (const p of legacyPending) {
      this.tmdb.searchShows(p.show.name).subscribe(results => {
        const match = results.find(s => this.isNameMatching(s.name, p.show.name)) || results[0];
        if (match) {
          this.tmdb.getShowDetails(match.id).subscribe(detailed => {
            if (detailed) {
              this.migrateShowInState(p.show.id, detailed);
            }
          });
        }
      });
    }
  }

  /**
   * Opens the details modal for a show.
   * Checks for ID mismatches between legacy TVMaze IDs and TMDB,
   * searching TMDB by show title to always load the correct show.
   * @param show - The show to display details for.
   */
  openDetails(show: TVShow): void {
    this.activeShowForDetails.set(show);
    
    const isLegacy = show.poster_path?.includes('tvmaze.com');
    if (isLegacy) {
      this.tmdb.searchShows(show.name).subscribe(results => {
        const match = results.find(s => this.isNameMatching(s.name, show.name)) || results[0];
        if (match) {
          this.tmdb.getShowDetails(match.id).subscribe(result => {
            if (result) {
              this.migrateShowInState(show.id, result);
              this.activeShowForDetails.set(result);
            }
          });
        }
      });
      return;
    }

    this.tmdb.getShowDetails(show.id).subscribe(result => {
      if (result && this.isNameMatching(result.name, show.name)) {
        this.activeShowForDetails.set(result);
      } else {
        // ID mismatch! Search TMDB by name to find the exact show
        this.tmdb.searchShows(show.name).subscribe(results => {
          const match = results.find(s => this.isNameMatching(s.name, show.name)) || results[0];
          if (match) {
            this.tmdb.getShowDetails(match.id).subscribe(correctShow => {
              if (correctShow) {
                this.migrateShowInState(show.id, correctShow);
                this.activeShowForDetails.set(correctShow);
              }
            });
          }
        });
      }
    });
  }

  /**
   * Opens the details modal by fetching a show by its TMDB ID.
   * Used when navigating via URL query parameters (shareable links).
   * @param showId - The TMDB show ID.
   */
  openDetailsById(showId: number): void {
    this.tmdb.getShowDetails(showId).subscribe(result => {
      if (result) {
        this.activeShowForDetails.set(result);
      }
    });
  }

  /**
   * Transitions from the details modal to the season-picker modal
   * so the user can select how many seasons they've watched.
   * Fetches full show details (with seasons) before opening the picker.
   * @param show - The show to add to the watchlist.
   */
  addDetailsShowToWatched(show: TVShow): void {
    this.activeShowForDetails.set(null);
    this.seasonWarning.set(null);

    const isLegacy = show.poster_path?.includes('tvmaze.com');
    if (isLegacy) {
      this.tmdb.searchShows(show.name).subscribe(results => {
        const match = results.find(s => this.isNameMatching(s.name, show.name)) || results[0];
        if (match) {
          this.tmdb.getShowDetails(match.id).subscribe(result => {
            if (result) {
              this.migrateShowInState(show.id, result);
              this.selectedShow.set(result);
              this.seasonsToAdd.set(0);
              this.seasonWarning.set(null);
            }
          });
        }
      });
      return;
    }

    this.tmdb.getShowDetails(show.id).subscribe(result => {
      if (result && this.isNameMatching(result.name, show.name)) {
        this.selectedShow.set(result);
        this.seasonsToAdd.set(0);
        this.seasonWarning.set(null);
      } else {
        this.tmdb.searchShows(show.name).subscribe(results => {
          const match = results.find(s => this.isNameMatching(s.name, show.name)) || results[0];
          if (match) {
            this.tmdb.getShowDetails(match.id).subscribe(correctShow => {
              if (correctShow) {
                this.migrateShowInState(show.id, correctShow);
                this.selectedShow.set(correctShow);
                this.seasonsToAdd.set(0);
                this.seasonWarning.set(null);
              }
            });
          }
        });
      }
    });
  }

  /** Closes the details modal. */
  closeDetailsModal(): void {
    this.activeShowForDetails.set(null);
  }

  /** Closes the season-picker modal and resets selected seasons. */
  closeSeasonModal(): void {
    this.selectedShow.set(null);
    this.seasonsToAdd.set(0);
    this.seasonWarning.set(null);
  }

  /** Checks if a specific season has already aired. */
  isSeasonAired(seasonNumber: number): boolean {
    const show = this.selectedShow();
    if (!show || !show.seasons || show.seasons.length === 0) return true;
    const s = show.seasons.find(season => season.season_number === seasonNumber);
    return s ? s.is_aired !== false : true;
  }

  /** Selects a season or warns the user if that season has not been released yet. */
  selectSeason(seasonNumber: number): void {
    const show = this.selectedShow();
    if (!show) return;
    const seasonObj = show.seasons?.find(s => s.season_number === seasonNumber);
    if (seasonObj && seasonObj.is_aired === false) {
      const airMsg = seasonObj.air_date ? ` (airs on ${seasonObj.air_date})` : '';
      this.seasonWarning.set(`Not possible to add Season ${seasonNumber} because it has not been released yet${airMsg}. Please select released seasons.`);
      return;
    }
    this.seasonWarning.set(null);
    this.seasonsToAdd.set(seasonNumber);
  }

  /**
   * Confirms the season selection and adds the show to the watchlist.
   * Called when the user presses "Add show" in the season-picker modal.
   */
  addShowFromModal(): void {
    const show = this.selectedShow();
    const seasons = this.seasonsToAdd();
    if (!show || seasons === 0) return;

    // Check if any of the selected seasons (1..seasons) are unreleased
    const unreleased = show.seasons?.find(s => s.season_number <= seasons && s.is_aired === false);
    if (unreleased) {
      const airMsg = unreleased.air_date ? ` (airs on ${unreleased.air_date})` : '';
      this.seasonWarning.set(`Not possible to add because Season ${unreleased.season_number} has not been released yet${airMsg}.`);
      return;
    }

    this.addWatchedShow(show, seasons);
    this.closeSeasonModal();
  }

  /**
   * Returns an array of season numbers [1..N] for the currently selected show.
   * Used to render the season selection buttons in the modal.
   */
  get seasonNumbers(): number[] {
    const show = this.selectedShow();
    if (!show?.number_of_seasons) return [];
    return Array.from({ length: show.number_of_seasons }, (_, i) => i + 1);
  }

  /** Computed total watch time across all watched shows (in minutes). */
  totalMinutes = computed(() => this.watchedShows().reduce((s, w) => s + w.totalMinutes, 0));
  /** Computed total number of episodes watched across all shows. */
  totalEpisodes = computed(() => this.watchedShows().reduce((s, w) => s + w.episodesWatched, 0));
  /** Computed days portion of total watch time, zero-padded to 2 digits. */
  days = computed(() => String(Math.floor(this.totalMinutes() / 1440)).padStart(2, '0'));
  /** Computed hours portion of total watch time, zero-padded to 2 digits. */
  hours = computed(() => String(Math.floor((this.totalMinutes() % 1440) / 60)).padStart(2, '0'));
  /** Computed minutes portion of total watch time, zero-padded to 2 digits. */
  minutes = computed(() => String(this.totalMinutes() % 60).padStart(2, '0'));

  /**
   * Calculates total watch time and episode count for a given number of seasons.
   * Uses actual season episode counts when available, otherwise assumes 10 episodes per season.
   * @param show - The TV show to calculate time for.
   * @param seasonsWatched - Number of seasons the user has watched.
   * @returns An object with total minutes and total episodes.
   */
  calculateTime(show: TVShow, seasonsWatched: number): { minutes: number; episodes: number } {
    let runtime = 45;
    if (typeof show?.episode_run_time === 'number' && show.episode_run_time > 0) {
      runtime = show.episode_run_time;
    } else if (Array.isArray(show?.episode_run_time) && (show.episode_run_time as any).length > 0) {
      runtime = Number((show.episode_run_time as any)[0]) || 45;
    }

    const seasons = show?.seasons || [];
    const count = Math.max(1, seasonsWatched);
    const episodes = seasons.length > 0
      ? seasons.slice(0, count).reduce((sum, s) => sum + (s.episode_count || 10), 0)
      : count * 10;

    return { minutes: Math.round(episodes * runtime), episodes };
  }

  /**
   * Creates a new watched show entry and adds it to the top of the watchlist.
   * Automatically removes the show from the pending list if present.
   * @param show - The TV show to add.
   * @param seasons - Number of seasons the user has watched.
   */
  addWatchedShow(show: TVShow, seasons: number): void {
    const t = this.calculateTime(show, seasons);
    const now = Date.now();
    const newInstance: WatchedShow = {
      instanceId: show.id.toString() + '_' + now.toString() + '_' + Math.random().toString(36).substr(2, 5),
      show: show,
      seasonsWatched: seasons,
      totalMinutes: t.minutes,
      episodesWatched: t.episodes,
      userRating: 0,
      addedAt: now
    };
    this.watchedShows.update(list => [newInstance, ...list]);
    this.removePending(show.id);
    this.save();

    const user = this.auth.user();
    if (user) {
      this.supabaseService.upsertWatchedShow(user.id, newInstance).catch(err => {
        console.error('Error saving show to Supabase:', err);
      });
    }
  }

  /**
   * Returns the maximum number of seasons that have already aired for a show.
   * Prevents adding unreleased upcoming seasons.
   */
  getMaxAiredSeasons(show: TVShow): number {
    if (!show || !show.seasons || show.seasons.length === 0) {
      return show?.number_of_seasons || 1;
    }
    const aired = show.seasons.filter(s => s.is_aired !== false);
    return aired.length > 0 ? aired.length : 1;
  }

  /**
   * Increments or decrements the number of watched seasons for a show.
   * Recalculates time and episode totals accordingly.
   * @param item - The watched show entry to update.
   * @param delta - The change in seasons (+1 or -1).
   */
  changeSeason(item: WatchedShow, delta: number): void {
    const maxAired = this.getMaxAiredSeasons(item.show);
    const newSeasons = item.seasonsWatched + delta;
    if (newSeasons < 1 || newSeasons > maxAired) return;
    const t = this.calculateTime(item.show, newSeasons);

    let updatedItem: WatchedShow | null = null;
    this.watchedShows.update(list => list.map(w => {
      if (w.instanceId === item.instanceId) {
        updatedItem = { ...w, seasonsWatched: newSeasons, totalMinutes: t.minutes, episodesWatched: t.episodes };
        return updatedItem;
      }
      return w;
    }));
    this.save();

    const user = this.auth.user();
    if (user && updatedItem) {
      this.supabaseService.upsertWatchedShow(user.id, updatedItem).catch(err => {
        console.error('Error updating seasons in Supabase:', err);
      });
    }
  }

  /**
   * Removes a watched show entry by its unique instance ID.
   * @param instanceId - The unique identifier of the watch instance to remove.
   */
  removeShow(instanceId: string): void {
    this.watchedShows.update(list => list.filter(w => w.instanceId !== instanceId));
    this.save();

    const user = this.auth.user();
    if (user) {
      this.supabaseService.deleteWatchedShow(user.id, instanceId).catch(err => {
        console.error('Error deleting show from Supabase:', err);
      });
    }
  }

  /**
   * Sets the user's personal rating for a watched show instance.
   * @param item - The watched show entry to rate.
   * @param rating - The rating value (1-10).
   */
  setUserRating(item: WatchedShow, rating: number): void {
    let updatedItem: WatchedShow | null = null;
    this.watchedShows.update(list => list.map(w => {
      if (w.instanceId === item.instanceId) {
        updatedItem = { ...w, userRating: rating };
        return updatedItem;
      }
      return w;
    }));
    this.save();

    const user = this.auth.user();
    if (user && updatedItem) {
      this.supabaseService.upsertWatchedShow(user.id, updatedItem).catch(err => {
        console.error('Error saving rating to Supabase:', err);
      });
    }
  }

  /**
   * Adds a show to the pending/to-watch list.
   * Skips if the show is already in pending.
   * @param show - The TV show to add to pending.
   */
  addToPending(show: TVShow): void {
    if (this.isInPending(show.id)) return;
    const entry: PendingShow = {
      id: show.id.toString() + '_p_' + Date.now(),
      show,
      addedAt: Date.now()
    };
    this.pendingShows.update(list => [entry, ...list]);
    this.savePending();

    const user = this.auth.user();
    if (user) {
      this.supabaseService.upsertPendingShow(user.id, entry).catch(err => {
        console.error('Error saving pending show to Supabase:', err);
      });
    }
  }

  /**
   * Removes a show from the pending list.
   * Accepts either the TVMaze show ID (number) or the pending entry ID (string).
   * @param id - The show ID or pending entry ID to remove.
   */
  removePending(id: string | number): void {
    const isNum = typeof id === 'number';
    let pendingIdToDelete: string | null = null;

    if (isNum) {
      const found = this.pendingShows().find(p => p.show.id === id);
      if (found) pendingIdToDelete = found.id;
    } else {
      pendingIdToDelete = id as string;
    }

    this.pendingShows.update(list => list.filter(p => isNum ? p.show.id !== id : p.id !== id));
    this.savePending();

    const user = this.auth.user();
    if (user && pendingIdToDelete) {
      this.supabaseService.deletePendingShow(user.id, pendingIdToDelete).catch(err => {
        console.error('Error deleting pending show from Supabase:', err);
      });
    }
  }

  /**
   * Checks if a show is currently in the pending list.
   * @param showId - The TVMaze show ID.
   * @returns True if the show is in the pending list.
   */
  isInPending(showId: number): boolean {
    return this.pendingShows().some(p => p.show.id === showId);
  }

  /**
   * Checks if a show has been added to the watched list (any instance).
   * @param showId - The TVMaze show ID.
   * @returns True if at least one watch instance exists for this show.
   */
  isWatched(showId: number): boolean {
    return this.watchedShows().some(w => w.show.id === showId);
  }

  /**
   * Checks watched shows for recent episode updates.
   * Rate-limited to once every 24 hours unless forced.
   * @param force - If true, bypasses the 24-hour cooldown.
   */
  checkForNewEpisodes(force = false): void {
    const watched = this.watchedShows();
    if (watched.length === 0) return;

    // Check if 24h have passed since last check (skip if forced)
    const lastCheck = parseInt(localStorage.getItem('lastUpdateCheck') || '0', 10);
    const now = Date.now();
    if (!force && now - lastCheck < 24 * 60 * 60 * 1000) return;

    this.checkingForUpdates.set(true);

    // Get unique show IDs from watchlist
    const uniqueShowIds = [...new Set(watched.map(w => w.show.id))];

    // Check episodes for shows
    const episodeRequests: Observable<NewEpisodeInfo[]>[] = uniqueShowIds.map(id => this.tmdb.getRecentEpisodes(id, 30));

    if (episodeRequests.length === 0) {
      this.checkingForUpdates.set(false);
      return;
    }

    forkJoin(episodeRequests).subscribe({
      next: (results: NewEpisodeInfo[][]) => {
        const alerts: NewEpisodeAlert[] = [];

        results.forEach((recentEps, index) => {
          if (recentEps.length === 0) return;
          const showId = uniqueShowIds[index];
          const representative = watched.find(w => w.show.id === showId);
          if (!representative) return;

          alerts.push({
            showId,
            showName: representative.show.name,
            posterPath: representative.show.poster_path,
            newEpisodeCount: recentEps.length,
            newEpisodes: recentEps,
            isUpcoming: recentEps.some(e => e.isUpcoming)
          });
        });

        this.newEpisodeAlerts.set(alerts);
        this.saveAlerts();
        localStorage.setItem('lastUpdateCheck', now.toString());
        this.checkingForUpdates.set(false);
      },
      error: () => {
        this.checkingForUpdates.set(false);
      }
    });
  }



  /**
   * Dismisses a single new-episode alert by show ID.
   * @param showId - The TVMaze show ID whose alert to dismiss.
   */
  dismissAlert(showId: number): void {
    this.newEpisodeAlerts.update(list => list.filter(a => a.showId !== showId));
    this.saveAlerts();
  }

  /** Dismisses all new-episode alerts at once. */
  dismissAllAlerts(): void {
    this.newEpisodeAlerts.set([]);
    this.saveAlerts();
  }

  /**
   * Checks if a show currently has an active new-episode alert.
   * @param showId - The TVMaze show ID.
   * @returns True if a new-episode alert exists for this show.
   */
  hasNewEpisodeAlert(showId: number): boolean {
    return this.newEpisodeAlerts().some(a => a.showId === showId);
  }

  /**
   * Resets all application data after user confirmation.
   * Clears watched shows, pending shows, and new-season alerts.
   */
  resetAll(): void {
    if (confirm('Are you sure you want to delete all shows?')) {
      this.watchedShows.set([]);
      this.pendingShows.set([]);
      this.newEpisodeAlerts.set([]);
      this.save();
      this.savePending();
      this.saveAlerts();

      // Also purge the user's data from the server when logged in
      const user = this.auth.user();
      if (user) {
        this.supabaseService.resetAllUserData(user.id).catch(err => {
          console.error('Error resetting user data on server:', err);
        });
      }
    }
  }

  /** Persists the watched shows list to localStorage. */
  private save(): void {
    localStorage.setItem('watchedShows', JSON.stringify(this.watchedShows()));
  }

  /**
   * Sorts a list of watched shows so the most recently added appears first.
   * For entries without an explicit addedAt, extracts the timestamp embedded
   * in instanceId (format: showId_timestamp_random) as a fallback.
   */
  private sortByAddedAt(list: WatchedShow[]): WatchedShow[] {
    return [...list].sort((a, b) => {
      const tsA = a.addedAt ?? this.extractTimestampFromInstanceId(a.instanceId);
      const tsB = b.addedAt ?? this.extractTimestampFromInstanceId(b.instanceId);
      return tsB - tsA;
    });
  }

  /**
   * Attempts to extract the embedded timestamp from an instanceId string.
   * instanceId format: "showId_timestamp_random" — returns 0 if parsing fails.
   */
  private extractTimestampFromInstanceId(instanceId: string): number {
    const parts = instanceId.split('_');
    if (parts.length >= 2) {
      const ts = parseInt(parts[1], 10);
      if (!isNaN(ts) && ts > 1_000_000_000_000) return ts; // valid ms timestamp
    }
    return 0;
  }

  /** Persists the pending shows list to localStorage. */
  private savePending(): void {
    localStorage.setItem('pendingShows', JSON.stringify(this.pendingShows()));
  }

  /**
   * Loads watched shows from localStorage.
   * Ensures backward compatibility by generating instanceId for legacy entries.
   * @returns The array of watched shows, or empty array on parse error.
   */
  private loadFromStorage(): WatchedShow[] {
    try {
      const data = JSON.parse(localStorage.getItem('watchedShows') || '[]');
      const list: WatchedShow[] = data.map((w: any) => {
        const item: WatchedShow = {
          ...w,
          instanceId: w.instanceId || w.show.id.toString() + '_' + Math.random().toString(36).substr(2, 5)
        };
        // Auto-repair if totalMinutes was 0 due to previous bug
        if (!item.totalMinutes || item.totalMinutes <= 0) {
          const t = this.calculateTime(item.show, item.seasonsWatched || 1);
          item.totalMinutes = t.minutes;
          item.episodesWatched = t.episodes;
        }
        return item;
      });
      return this.sortByAddedAt(list);
    } catch {
      return [];
    }
  }

  /**
   * Loads pending shows from localStorage.
   * @returns The array of pending shows, or empty array on parse error.
   */
  private loadPendingFromStorage(): PendingShow[] {
    try {
      return JSON.parse(localStorage.getItem('pendingShows') || '[]');
    } catch {
      return [];
    }
  }

  /** Persists the new-episode alerts to localStorage. */
  private saveAlerts(): void {
    localStorage.setItem('newEpisodeAlerts', JSON.stringify(this.newEpisodeAlerts()));
  }

  /**
   * Loads new-episode alerts from localStorage.
   * @returns The array of alerts, or empty array on parse error.
   */
  private loadAlertsFromStorage(): NewEpisodeAlert[] {
    try {
      // Also migrate old 'newSeasonAlerts' key if present
      const legacy = localStorage.getItem('newSeasonAlerts');
      if (legacy) {
        localStorage.removeItem('newSeasonAlerts');
      }
      return JSON.parse(localStorage.getItem('newEpisodeAlerts') || '[]');
    } catch {
      return [];
    }
  }
}
