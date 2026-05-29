import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, map, catchError } from 'rxjs';
import { TVShow, Season } from '../models';

@Injectable({ providedIn: 'root' })
export class TvmazeService {
  private http = inject(HttpClient);
  private baseUrl = 'https://api.tvmaze.com';

  searchShows(query: string): Observable<TVShow[]> {
    return this.http.get<any[]>(`${this.baseUrl}/search/shows?q=${encodeURIComponent(query)}`).pipe(
      map(results => results.slice(0, 8).map(item => this.mapShow(item.show))),
      catchError(() => of([]))
    );
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
      summary: show.summary || ''
    };
  }
}
