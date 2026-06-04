import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, map, catchError, switchMap } from 'rxjs';
import { TVShow, Season } from '../models';

@Injectable({ providedIn: 'root' })
export class TvmazeService {
  private http = inject(HttpClient);
  private baseUrl = 'https://api.tvmaze.com';
  private topRatedShowsCache: TVShow[] | null = null;

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

  searchAllShows(query: string): Observable<TVShow[]> {
    const trimmed = query.trim();
    return this.http.get<any[]>(`${this.baseUrl}/search/shows?q=${encodeURIComponent(trimmed)}`).pipe(
      switchMap(results => {
        if (results.length > 0) return of(this.processResults(results, trimmed, 50));
        const words = trimmed.split(/\s+/);
        if (words.length > 1) {
          const fallback = words.slice(0, -1).join(' ');
          return this.http.get<any[]>(`${this.baseUrl}/search/shows?q=${encodeURIComponent(fallback)}`).pipe(
            map(r => this.processResults(r, trimmed, 50))
          );
        }
        return of([]);
      }),
      catchError(() => of([]))
    );
  }

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
        // 1st: name starts with full query
        const aStarts = a.name.startsWith(q) ? 0 : 1;
        const bStarts = b.name.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        // 2nd: name contains all typed words
        const aAll = words.every(w => a.name.includes(w)) ? 0 : 1;
        const bAll = words.every(w => b.name.includes(w)) ? 0 : 1;
        if (aAll !== bAll) return aAll - bAll;
        // 3rd: name contains the full query string
        const aContains = a.name.includes(q) ? 0 : 1;
        const bContains = b.name.includes(q) ? 0 : 1;
        if (aContains !== bContains) return aContains - bContains;
        // 4th: TVMaze relevance score
        return b.score - a.score;
      })
      .slice(0, limit)
      .map(item => item.show);
  }

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


  getPopularShows(): Observable<TVShow[]> {
    return this.http.get<any[]>(`${this.baseUrl}/shows?page=0`).pipe(
      map(shows => {
        if (!Array.isArray(shows)) return [];
        // Sort by weight descending to get the most popular shows on the page
        return shows
          .filter(show => show.image?.medium)
          .sort((a, b) => (b.weight || 0) - (a.weight || 0))
          .slice(0, 15)
          .map(show => this.mapShow(show));
      }),
      catchError(() => of([]))
    );
  }

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
