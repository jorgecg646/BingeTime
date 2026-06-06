import { Injectable, signal, computed, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TVShow, WatchedShow, PendingShow, NewSeasonAlert } from '../models';
import { TvmazeService } from './tvmaze.service';

@Injectable({
  providedIn: 'root'
})
export class ShowStateService {
  private tvmaze = inject(TvmazeService);

  /** Reactive list of all shows the user has watched. Persisted in localStorage. */
  watchedShows = signal<WatchedShow[]>(this.loadFromStorage());
  /** Reactive list of shows saved to watch later. Persisted in localStorage. */
  pendingShows = signal<PendingShow[]>(this.loadPendingFromStorage());

  /** Alerts for shows in the watchlist that have new seasons available. */
  newSeasonAlerts = signal<NewSeasonAlert[]>(this.loadAlertsFromStorage());
  /** Whether a background check for new seasons is currently in progress. */
  checkingForUpdates = signal<boolean>(false);

  /** The show currently displayed in the details modal, or null if closed. */
  activeShowForDetails = signal<TVShow | null>(null);
  /** The show currently selected in the season-picker modal, or null if closed. */
  selectedShow = signal<TVShow | null>(null);
  /** Number of seasons selected in the season-picker modal. */
  seasonsToAdd = signal<number>(0);

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
    this.save();
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
    this.watchedShows.update(list => list.map(w =>
      w.instanceId === item.instanceId ? { ...w, seasonsWatched: newSeasons, totalMinutes: t.minutes, episodesWatched: t.episodes } : w
    ));
    this.save();
  }

  /**
   * Removes a watched show entry by its unique instance ID.
   * @param instanceId - The unique identifier of the watch instance to remove.
   */
  removeShow(instanceId: string): void {
    this.watchedShows.update(list => list.filter(w => w.instanceId !== instanceId));
    this.save();
  }

  /**
   * Sets the user's personal rating for a watched show instance.
   * @param item - The watched show entry to rate.
   * @param rating - The rating value (1-10).
   */
  setUserRating(item: WatchedShow, rating: number): void {
    this.watchedShows.update(list => list.map(w =>
      w.instanceId === item.instanceId ? { ...w, userRating: rating } : w
    ));
    this.save();
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
  }

  /**
   * Removes a show from the pending list.
   * Accepts either the TVMaze show ID (number) or the pending entry ID (string).
   * @param id - The show ID or pending entry ID to remove.
   */
  removePending(id: string | number): void {
    const isNum = typeof id === 'number';
    this.pendingShows.update(list => list.filter(p => isNum ? p.show.id !== id : p.id !== id));
    this.savePending();
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
   * Checks all watched shows for new seasons by comparing against TVMaze updates.
   * Rate-limited to once every 24 hours unless forced.
   * When new seasons are detected, creates alerts and persists them.
   * @param force - If true, bypasses the 24-hour cooldown.
   */
  checkForNewSeasons(force = false): void {
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
      // Filter to only our shows, and only those that changed
      const changedShowIds = uniqueShowIds.filter(id => {
        const remoteTs = updates[id.toString()];
        const localTs = storedTimestamps[id.toString()] || 0;
        return remoteTs && remoteTs > localTs;
      });

      if (changedShowIds.length === 0) {
        // Nothing changed, just update the check timestamp
        localStorage.setItem('lastUpdateCheck', now.toString());
        // Update all timestamps for our shows
        uniqueShowIds.forEach(id => {
          if (updates[id.toString()]) {
            storedTimestamps[id.toString()] = updates[id.toString()];
          }
        });
        localStorage.setItem('showUpdateTimestamps', JSON.stringify(storedTimestamps));
        this.checkingForUpdates.set(false);
        return;
      }

      // Fetch seasons for changed shows (respecting rate limits with forkJoin)
      const seasonRequests = changedShowIds.map(id => this.tvmaze.getShowSeasons(id));

      forkJoin(seasonRequests).subscribe(seasonResults => {
        const alerts: NewSeasonAlert[] = [];

        changedShowIds.forEach((showId, index) => {
          const currentSeasonCount = seasonResults[index].length;
          // Find the max seasons the user has watched for this show
          const userInstances = watched.filter(w => w.show.id === showId);
          const maxWatched = Math.max(...userInstances.map(w => w.show.number_of_seasons || w.seasonsWatched));
          const representative = userInstances[0];

          if (currentSeasonCount > maxWatched && representative) {
            const newNums: number[] = [];
            for (let s = maxWatched + 1; s <= currentSeasonCount; s++) {
              newNums.push(s);
            }
            alerts.push({
              showId,
              showName: representative.show.name,
              posterPath: representative.show.poster_path,
              previousSeasons: maxWatched,
              currentSeasons: currentSeasonCount,
              newSeasonNumbers: newNums
            });
          }

          // Update timestamps
          if (updates[showId.toString()]) {
            storedTimestamps[showId.toString()] = updates[showId.toString()];
          }
        });

        // Merge with existing alerts (don't duplicate)
        const existingAlerts = this.newSeasonAlerts();
        const mergedAlerts = [...existingAlerts];
        for (const alert of alerts) {
          if (!mergedAlerts.some(a => a.showId === alert.showId)) {
            mergedAlerts.push(alert);
          } else {
            // Update existing alert with fresh data
            const idx = mergedAlerts.findIndex(a => a.showId === alert.showId);
            mergedAlerts[idx] = alert;
          }
        }

        this.newSeasonAlerts.set(mergedAlerts);
        this.saveAlerts();

        // Update all timestamps for our shows
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
   * Dismisses a single new-season alert by show ID.
   * @param showId - The TVMaze show ID whose alert to dismiss.
   */
  dismissAlert(showId: number): void {
    this.newSeasonAlerts.update(list => list.filter(a => a.showId !== showId));
    this.saveAlerts();
  }

  /** Dismisses all new-season alerts at once. */
  dismissAllAlerts(): void {
    this.newSeasonAlerts.set([]);
    this.saveAlerts();
  }

  /**
   * Checks if a show currently has an active new-season alert.
   * @param showId - The TVMaze show ID.
   * @returns True if a new-season alert exists for this show.
   */
  hasNewSeasonAlert(showId: number): boolean {
    return this.newSeasonAlerts().some(a => a.showId === showId);
  }

  /**
   * Resets all application data after user confirmation.
   * Clears watched shows, pending shows, and new-season alerts.
   */
  resetAll(): void {
    if (confirm('Are you sure you want to delete all shows?')) {
      this.watchedShows.set([]);
      this.pendingShows.set([]);
      this.newSeasonAlerts.set([]);
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

  /** Persists the new-season alerts to localStorage. */
  private saveAlerts(): void {
    localStorage.setItem('newSeasonAlerts', JSON.stringify(this.newSeasonAlerts()));
  }

  /**
   * Loads new-season alerts from localStorage.
   * @returns The array of alerts, or empty array on parse error.
   */
  private loadAlertsFromStorage(): NewSeasonAlert[] {
    try {
      return JSON.parse(localStorage.getItem('newSeasonAlerts') || '[]');
    } catch {
      return [];
    }
  }
}
