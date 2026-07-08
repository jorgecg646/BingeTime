import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TVShow, WatchedShow, PendingShow, NewEpisodeAlert } from '../models';
import { TvmazeService } from './tvmaze.service';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ShowStateService {
  private tvmaze = inject(TvmazeService);
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
      }
    });
  }

  private async loadUserDataFromNeon(userId: string) {
    this.isSyncingFromNeon.set(true);
    try {
      const [remoteWatched, remotePending] = await Promise.all([
        this.supabaseService.getWatchedShows(userId),
        this.supabaseService.getPendingShows(userId)
      ]);

      const localWatched = this.loadFromStorage();
      const localPending = this.loadPendingFromStorage();

      // Migrate local data to Neon if the cloud is empty on first login
      if (remoteWatched.length === 0 && localWatched.length > 0) {
        for (const item of localWatched) {
          await this.supabaseService.upsertWatchedShow(userId, item);
        }
        this.watchedShows.set(localWatched);
      } else {
        this.watchedShows.set(remoteWatched);
      }

      if (remotePending.length === 0 && localPending.length > 0) {
        for (const item of localPending) {
          await this.supabaseService.upsertPendingShow(userId, item);
        }
        this.pendingShows.set(localPending);
      } else {
        this.pendingShows.set(remotePending);
      }

      // Persist the fresh Neon data to localStorage so the next page visit
      // can show it instantly as a cache while the background sync runs.
      localStorage.setItem('watchedShows', JSON.stringify(this.watchedShows()));
      localStorage.setItem('pendingShows', JSON.stringify(this.pendingShows()));
    } catch (err) {
      console.error('Error loading user data from Neon:', err);
      // Falls back to localStorage data already shown on screen — no disruption.
    } finally {
      this.isSyncingFromNeon.set(false);
    }
  }

  /**
   * Opens the details modal for a show.
   * If the show already has a summary cached, displays it immediately.
   * Otherwise, fetches full details from the API first.
   * @param show - The show to display details for.
   */
  openDetails(show: TVShow): void {
    if (show.summary) {
      this.activeShowForDetails.set(show);
    } else {
      this.tvmaze.getShowDetails(show.id).subscribe(result => {
        if (result) {
          this.activeShowForDetails.set(result);
        }
      });
    }
  }

  /**
   * Opens the details modal by fetching a show by its TVMaze ID.
   * Used when navigating via URL query parameters (shareable links).
   * @param showId - The TVMaze show ID.
   */
  openDetailsById(showId: number): void {
    this.tvmaze.getShowDetails(showId).subscribe(result => {
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
    this.tvmaze.getShowDetails(show.id).subscribe(result => {
      if (result) {
        this.selectedShow.set(result);
        this.seasonsToAdd.set(0);
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
  }

  /**
   * Confirms the season selection and adds the show to the watchlist.
   * Called when the user presses "Add show" in the season-picker modal.
   */
  addShowFromModal(): void {
    const show = this.selectedShow();
    const seasons = this.seasonsToAdd();
    if (!show || seasons === 0) return;
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
    const runtime = show.episode_run_time || 45;
    const episodes = show.seasons.length
      ? show.seasons.slice(0, seasonsWatched).reduce((sum, s) => sum + s.episode_count, 0)
      : seasonsWatched * 10;
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
    const newInstance: WatchedShow = {
      instanceId: show.id.toString() + '_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
      show: show,
      seasonsWatched: seasons,
      totalMinutes: t.minutes,
      episodesWatched: t.episodes,
      userRating: 0
    };
    this.watchedShows.update(list => [newInstance, ...list]);
    this.removePending(show.id);

    const user = this.auth.user();
    if (user) {
      this.supabaseService.upsertWatchedShow(user.id, newInstance).catch(err => {
        console.error('Error saving show to Supabase:', err);
      });
    } else {
      this.save();
    }
  }

  /**
   * Increments or decrements the number of watched seasons for a show.
   * Recalculates time and episode totals accordingly.
   * @param item - The watched show entry to update.
   * @param delta - The change in seasons (+1 or -1).
   */
  changeSeason(item: WatchedShow, delta: number): void {
    const newSeasons = item.seasonsWatched + delta;
    if (newSeasons < 1 || newSeasons > item.show.number_of_seasons) return;
    const t = this.calculateTime(item.show, newSeasons);

    let updatedItem: WatchedShow | null = null;
    this.watchedShows.update(list => list.map(w => {
      if (w.instanceId === item.instanceId) {
        updatedItem = { ...w, seasonsWatched: newSeasons, totalMinutes: t.minutes, episodesWatched: t.episodes };
        return updatedItem;
      }
      return w;
    }));

    const user = this.auth.user();
    if (user && updatedItem) {
      this.supabaseService.upsertWatchedShow(user.id, updatedItem).catch(err => {
        console.error('Error updating seasons in Supabase:', err);
      });
    } else {
      this.save();
    }
  }

  /**
   * Removes a watched show entry by its unique instance ID.
   * @param instanceId - The unique identifier of the watch instance to remove.
   */
  removeShow(instanceId: string): void {
    this.watchedShows.update(list => list.filter(w => w.instanceId !== instanceId));

    const user = this.auth.user();
    if (user) {
      this.supabaseService.deleteWatchedShow(user.id, instanceId).catch(err => {
        console.error('Error deleting show from Supabase:', err);
      });
    } else {
      this.save();
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

    const user = this.auth.user();
    if (user && updatedItem) {
      this.supabaseService.upsertWatchedShow(user.id, updatedItem).catch(err => {
        console.error('Error saving rating to Supabase:', err);
      });
    } else {
      this.save();
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

    const user = this.auth.user();
    if (user) {
      this.supabaseService.upsertPendingShow(user.id, entry).catch(err => {
        console.error('Error saving pending show to Supabase:', err);
      });
    } else {
      this.savePending();
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

    const user = this.auth.user();
    if (user && pendingIdToDelete) {
      this.supabaseService.deletePendingShow(user.id, pendingIdToDelete).catch(err => {
        console.error('Error deleting pending show from Supabase:', err);
      });
    } else {
      this.savePending();
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
   * Checks all watched shows for new episodes aired in the last 30 days
   * by querying TVMaze's monthly updates endpoint and then fetching each
   * changed show's episode list.
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
    const storedTimestamps: Record<string, number> = JSON.parse(localStorage.getItem('showUpdateTimestamps') || '{}');

    this.tvmaze.getShowUpdates().subscribe(updates => {
      // Filter to only our shows that had any change since we last checked
      const changedShowIds = uniqueShowIds.filter(id => {
        const remoteTs = updates[id.toString()];
        const localTs = storedTimestamps[id.toString()] || 0;
        return remoteTs && remoteTs > localTs;
      });

      if (changedShowIds.length === 0) {
        // Nothing changed – update the check timestamp and stored timestamps
        localStorage.setItem('lastUpdateCheck', now.toString());
        uniqueShowIds.forEach(id => {
          if (updates[id.toString()]) {
            storedTimestamps[id.toString()] = updates[id.toString()];
          }
        });
        localStorage.setItem('showUpdateTimestamps', JSON.stringify(storedTimestamps));
        this.checkingForUpdates.set(false);
        return;
      }

      // Fetch recent episodes (last 30 days) for all changed shows in parallel
      const episodeRequests = changedShowIds.map(id => this.tvmaze.getRecentEpisodes(id, 30));

      forkJoin(episodeRequests).subscribe(episodeResults => {
        const alerts: NewEpisodeAlert[] = [];

        changedShowIds.forEach((showId, index) => {
          const recentEps = episodeResults[index];
          if (recentEps.length === 0) return;

          const representative = watched.find(w => w.show.id === showId);
          if (!representative) return;

          alerts.push({
            showId,
            showName: representative.show.name,
            posterPath: representative.show.poster_path,
            newEpisodeCount: recentEps.length,
            newEpisodes: recentEps
          });

          // Update timestamps
          if (updates[showId.toString()]) {
            storedTimestamps[showId.toString()] = updates[showId.toString()];
          }
        });

        // Merge with existing alerts (update if show already has one)
        const existingAlerts = this.newEpisodeAlerts();
        const mergedAlerts = [...existingAlerts];
        for (const alert of alerts) {
          const idx = mergedAlerts.findIndex(a => a.showId === alert.showId);
          if (idx === -1) {
            mergedAlerts.push(alert);
          } else {
            mergedAlerts[idx] = alert;
          }
        }

        this.newEpisodeAlerts.set(mergedAlerts);
        this.saveAlerts();

        // Update all timestamps for our shows (also those without new episodes)
        uniqueShowIds.forEach(id => {
          if (updates[id.toString()] && !storedTimestamps[id.toString()]) {
            storedTimestamps[id.toString()] = updates[id.toString()];
          }
        });
        localStorage.setItem('showUpdateTimestamps', JSON.stringify(storedTimestamps));
        localStorage.setItem('lastUpdateCheck', now.toString());
        this.checkingForUpdates.set(false);
      });
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
    }
  }

  /** Persists the watched shows list to localStorage. */
  private save(): void {
    localStorage.setItem('watchedShows', JSON.stringify(this.watchedShows()));
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
      return data.map((w: any) => ({
        ...w,
        instanceId: w.instanceId || w.show.id.toString() + '_' + Math.random().toString(36).substr(2, 5)
      }));
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
