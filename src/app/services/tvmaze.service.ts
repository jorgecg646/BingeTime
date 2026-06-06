import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, map, catchError, switchMap } from 'rxjs';
import { TVShow, Season } from '../models';

@Injectable({ providedIn: 'root' })
export class TvmazeService {
  private http = inject(HttpClient);
  private baseUrl = 'https://api.tvmaze.com';
  private topRatedShowsCache: TVShow[] | null = null;

  /**
   * Searches for TV shows by query string.
   * If the initial search returns no results, retries by removing the last word
   * (handles incomplete/partial typing). Results are sorted by relevance.
   * @param query - The search term entered by the user.
   * @returns An observable emitting an array of up to 8 matching TVShow results.
   */
  searchShows(query: string): Observable<TVShow[]> {
    const trimmed = query.trim();
    return this.http.get<any[]>(`${this.baseUrl}/search/shows?q=${encodeURIComponent(trimmed)}`).pipe(
      switchMap(results => {
        if (results.length > 0) {
          return of(this.processResults(results, trimmed));
        }
        // Fallback: retry without the last (incomplete) word
        const words = trimmed.split(/\s+/);
        if (words.length > 1) {
          const fallback = words.slice(0, -1).join(' ');
          return this.http.get<any[]>(`${this.baseUrl}/search/shows?q=${encodeURIComponent(fallback)}`).pipe(
            map(r => this.processResults(r, trimmed))
          );
        }
        return of([]);
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Sorts and ranks search results by relevance to the query.
   * Priority order: name starts with query > contains all words > contains full query > TVMaze score.
   * @param results - Raw API results from TVMaze search endpoint.
   * @param query - The original search query for relevance comparison.
   * @param limit - Maximum number of results to return (default: 8).
   * @returns A sorted and limited array of TVShow objects.
   */
  private processResults(results: any[], query: string, limit = 8): TVShow[] {
    const q = query.toLowerCase();
    const words = q.split(/\s+/);
    return results
      .map(item => ({
        show: this.mapShow(item.show),
        score: item.score as number,
        name: (item.show.name as string).toLowerCase()
      }))
      .sort((a, b) => {
        const aStarts = a.name.startsWith(q) ? 0 : 1;
        const bStarts = b.name.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        const aAll = words.every(w => a.name.includes(w)) ? 0 : 1;
        const bAll = words.every(w => b.name.includes(w)) ? 0 : 1;
        if (aAll !== bAll) return aAll - bAll;
        const aContains = a.name.includes(q) ? 0 : 1;
        const bContains = b.name.includes(q) ? 0 : 1;
        if (aContains !== bContains) return aContains - bContains;
        return b.score - a.score;
      })
      .slice(0, limit)
      .map(item => item.show);
  }

  /**
   * Fetches full details for a single show, including its seasons.
   * Combines the show details and seasons API calls into a single response.
   * @param showId - The TVMaze show ID.
   * @returns An observable emitting the enriched TVShow or null on error.
   */
  getShowDetails(showId: number): Observable<TVShow | null> {
    return forkJoin({
      details: this.http.get<any>(`${this.baseUrl}/shows/${showId}`),
      seasons: this.http.get<any[]>(`${this.baseUrl}/shows/${showId}/seasons`)
    }).pipe(
      map(res => {
        const seasons: Season[] = res.seasons
          .filter((s: any) => s.number > 0)
          .map((s: any) => ({ season_number: s.number, episode_count: s.episodeOrder || 10 }));
        return {
          ...this.mapShow(res.details),
          seasons,
          number_of_seasons: seasons.length
        };
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Fetches the top-rated shows from TVMaze (pages 0 and 1).
   * Results are cached in memory after the first load to avoid redundant API calls.
   * @returns An observable emitting up to 250 TVShow objects sorted by rating descending.
   */
  getTopRatedShows(): Observable<TVShow[]> {
    if (this.topRatedShowsCache) {
      return of(this.topRatedShowsCache);
    }
    return forkJoin({
      page0: this.http.get<any[]>(`${this.baseUrl}/shows?page=0`).pipe(catchError(() => of([]))),
      page1: this.http.get<any[]>(`${this.baseUrl}/shows?page=1`).pipe(catchError(() => of([])))
    }).pipe(
      map(res => {
        const allShows = [...(res.page0 || []), ...(res.page1 || [])];
        if (allShows.length === 0) return [];
        const mapped = allShows
          .filter(show => show.image?.medium)
          .map(show => this.mapShow(show))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 250);
        this.topRatedShowsCache = mapped;
        return mapped;
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetches recently updated show IDs and their timestamps from TVMaze.
   * Used to detect new seasons for shows in the user's watchlist.
   * @returns An observable emitting a record mapping show ID strings to Unix timestamps.
   */
  getShowUpdates(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.baseUrl}/updates/shows?since=day`).pipe(
      catchError(() => of({}))
    );
  }

  /**
   * Fetches all seasons for a specific show.
   * Filters out specials (season number <= 0).
   * @param showId - The TVMaze show ID.
   * @returns An observable emitting an array of Season objects.
   */
  getShowSeasons(showId: number): Observable<Season[]> {
    return this.http.get<any[]>(`${this.baseUrl}/shows/${showId}/seasons`).pipe(
      map(seasons => seasons
        .filter((s: any) => s.number > 0)
        .map((s: any) => ({ season_number: s.number, episode_count: s.episodeOrder || 10 }))
      ),
      catchError(() => of([]))
    );
  }

  /**
   * Maps a raw TVMaze API show object to the internal TVShow model.
   * Provides sensible defaults for missing fields.
   * @param show - Raw show object from the TVMaze API.
   * @returns A normalized TVShow object.
   */
  private mapShow(show: any): TVShow {
    return {
      id: show.id,
      name: show.name,
      poster_path: show.image?.medium || 'https://via.placeholder.com/210x295/1e293b/6366f1?text=No+Image',
      first_air_date: show.premiered || '',
      number_of_seasons: 0,
      episode_run_time: show.averageRuntime || show.runtime || 45,
      rating: show.rating?.average ?? null,
      seasons: [],
      summary: show.summary || '',
      genres: show.genres || []
    };
  }
}
