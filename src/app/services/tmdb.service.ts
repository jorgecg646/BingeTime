import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin, map, catchError } from 'rxjs';
import { TVShow, Season, NewEpisodeInfo, WatchProvider, SeasonDetail, EpisodeDetail, PersonDetail, PersonTvCreditShow } from '../models';
import { environment } from '../../environments/environment';

// Genre ID to Name mapping for TMDB TV genres
const TMDB_GENRES: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western'
};

export interface CountryOption {
  code: string;
  name: string;
  flagUrl: string;
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { code: 'DE', name: 'Alemania', flagUrl: 'https://flagcdn.com/w40/de.png' },
  { code: 'SA', name: 'Arabia Saudita', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  { code: 'AR', name: 'Argentina', flagUrl: 'https://flagcdn.com/w40/ar.png' },
  { code: 'AU', name: 'Australia', flagUrl: 'https://flagcdn.com/w40/au.png' },
  { code: 'AT', name: 'Austria', flagUrl: 'https://flagcdn.com/w40/at.png' },
  { code: 'BE', name: 'Bélgica', flagUrl: 'https://flagcdn.com/w40/be.png' },
  { code: 'BO', name: 'Bolivia', flagUrl: 'https://flagcdn.com/w40/bo.png' },
  { code: 'BR', name: 'Brasil', flagUrl: 'https://flagcdn.com/w40/br.png' },
  { code: 'CA', name: 'Canadá', flagUrl: 'https://flagcdn.com/w40/ca.png' },
  { code: 'CL', name: 'Chile', flagUrl: 'https://flagcdn.com/w40/cl.png' },
  { code: 'CO', name: 'Colombia', flagUrl: 'https://flagcdn.com/w40/co.png' },
  { code: 'CR', name: 'Costa Rica', flagUrl: 'https://flagcdn.com/w40/cr.png' },
  { code: 'DK', name: 'Dinamarca', flagUrl: 'https://flagcdn.com/w40/dk.png' },
  { code: 'EC', name: 'Ecuador', flagUrl: 'https://flagcdn.com/w40/ec.png' },
  { code: 'ES', name: 'España', flagUrl: 'https://flagcdn.com/w40/es.png' },
  { code: 'US', name: 'Estados Unidos', flagUrl: 'https://flagcdn.com/w40/us.png' },
  { code: 'PH', name: 'Filipinas', flagUrl: 'https://flagcdn.com/w40/ph.png' },
  { code: 'FI', name: 'Finlandia', flagUrl: 'https://flagcdn.com/w40/fi.png' },
  { code: 'FR', name: 'Francia', flagUrl: 'https://flagcdn.com/w40/fr.png' },
  { code: 'GR', name: 'Grecia', flagUrl: 'https://flagcdn.com/w40/gr.png' },
  { code: 'GT', name: 'Guatemala', flagUrl: 'https://flagcdn.com/w40/gt.png' },
  { code: 'HN', name: 'Honduras', flagUrl: 'https://flagcdn.com/w40/hn.png' },
  { code: 'IN', name: 'India', flagUrl: 'https://flagcdn.com/w40/in.png' },
  { code: 'ID', name: 'Indonesia', flagUrl: 'https://flagcdn.com/w40/id.png' },
  { code: 'IE', name: 'Irlanda', flagUrl: 'https://flagcdn.com/w40/ie.png' },
  { code: 'IT', name: 'Italia', flagUrl: 'https://flagcdn.com/w40/it.png' },
  { code: 'JP', name: 'Japón', flagUrl: 'https://flagcdn.com/w40/jp.png' },
  { code: 'MX', name: 'México', flagUrl: 'https://flagcdn.com/w40/mx.png' },
  { code: 'NO', name: 'Noruega', flagUrl: 'https://flagcdn.com/w40/no.png' },
  { code: 'NZ', name: 'Nueva Zelanda', flagUrl: 'https://flagcdn.com/w40/nz.png' },
  { code: 'NL', name: 'Países Bajos', flagUrl: 'https://flagcdn.com/w40/nl.png' },
  { code: 'PA', name: 'Panamá', flagUrl: 'https://flagcdn.com/w40/pa.png' },
  { code: 'PY', name: 'Paraguay', flagUrl: 'https://flagcdn.com/w40/py.png' },
  { code: 'PE', name: 'Perú', flagUrl: 'https://flagcdn.com/w40/pe.png' },
  { code: 'PL', name: 'Polonia', flagUrl: 'https://flagcdn.com/w40/pl.png' },
  { code: 'PT', name: 'Portugal', flagUrl: 'https://flagcdn.com/w40/pt.png' },
  { code: 'GB', name: 'Reino Unido', flagUrl: 'https://flagcdn.com/w40/gb.png' },
  { code: 'DO', name: 'República Dominicana', flagUrl: 'https://flagcdn.com/w40/do.png' },
  { code: 'SE', name: 'Suecia', flagUrl: 'https://flagcdn.com/w40/se.png' },
  { code: 'CH', name: 'Suiza', flagUrl: 'https://flagcdn.com/w40/ch.png' },
  { code: 'TR', name: 'Turquía', flagUrl: 'https://flagcdn.com/w40/tr.png' },
  { code: 'UY', name: 'Uruguay', flagUrl: 'https://flagcdn.com/w40/uy.png' },
  { code: 'VE', name: 'Venezuela', flagUrl: 'https://flagcdn.com/w40/ve.png' }
];

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private http = inject(HttpClient);
  private baseUrl = environment.tmdbBaseUrl || 'https://api.themoviedb.org/3';
  private imageBaseUrl = environment.tmdbImageBaseUrl || 'https://image.tmdb.org/t/p';
  private topRatedShowsCache: TVShow[] | null = null;
  private showDetailsCache = new Map<number, TVShow>();
  private seasonDetailsCache = new Map<string, SeasonDetail>();
  private personDetailsCache = new Map<number, PersonDetail>();
  private discoverCache = new Map<string, { page: number; totalPages: number; totalResults: number; shows: TVShow[] }>();
  private trendingCache: TVShow[] | null = null;

  readonly COUNTRIES = SUPPORTED_COUNTRIES;
  readonly selectedCountry = signal<string>(this.getInitialCountryCode());
  readonly isRegionModalOpen = signal<boolean>(false);
  readonly activePersonModalId = signal<number | null>(null);

  readonly activeCountry = this.selectedCountry.asReadonly();
  readonly activeCountryInfo = computed(() => {
    const code = this.selectedCountry();
    return this.COUNTRIES.find(c => c.code === code) || this.COUNTRIES[14]; // Default to ES
  });
  readonly activeCountryFlagUrl = computed(() => this.activeCountryInfo().flagUrl);
  readonly activeCountryName = computed(() => this.activeCountryInfo().name);

  openRegionModal(): void {
    this.isRegionModalOpen.set(true);
  }

  closeRegionModal(): void {
    this.isRegionModalOpen.set(false);
  }

  openPersonModal(personId: number): void {
    this.activePersonModalId.set(personId);
  }

  closePersonModal(): void {
    this.activePersonModalId.set(null);
  }

  private getInitialCountryCode(): string {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('bingetime_user_region');
        if (saved && saved.trim().length === 2) return saved.toUpperCase();
      }
      if (typeof navigator !== 'undefined') {
        const lang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
        if (lang.includes('-')) {
          const region = lang.split('-')[1].toUpperCase();
          if (region.length === 2) return region;
        }
        if (lang.toLowerCase().startsWith('es')) return 'ES';
        if (lang.toLowerCase().startsWith('en')) return 'US';
      }
    } catch {
      // fallback
    }
    return 'ES';
  }

  /**
   * Sets the active country and refreshes caches.
   */
  setCountry(code: string): void {
    const upper = code.toUpperCase();
    this.selectedCountry.set(upper);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bingetime_user_region', upper);
      }
    } catch {}
    this.discoverCache.clear();
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    if (environment.tmdbApiToken && environment.tmdbApiToken.trim()) {
      headers = headers.set('Authorization', `Bearer ${environment.tmdbApiToken.trim()}`);
    }
    return headers;
  }

  private addAuthParams(params: HttpParams = new HttpParams()): HttpParams {
    if (!environment.tmdbApiToken && environment.tmdbApiKey && environment.tmdbApiKey.trim()) {
      return params.set('api_key', environment.tmdbApiKey.trim());
    }
    return params;
  }

  /** Helper to build HttpParams from a simple object map including auth parameters. */
  private createParams(obj: Record<string, string | number | boolean | undefined>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        params = params.set(key, String(value));
      }
    }
    return this.addAuthParams(params);
  }

  getUserCountryCode(): string {
    return this.selectedCountry();
  }

  /**
   * Searches for TV shows on TMDB by query string.
   * @param query - The search term entered by the user.
   * @returns An observable emitting an array of matching TVShow results.
   */
  searchShows(query: string): Observable<TVShow[]> {
    const trimmed = query.trim();
    if (!trimmed) return of([]);

    const params = this.createParams({
      query: trimmed,
      language: 'en-US',
      include_adult: 'false',
      page: '1'
    });

    return this.http.get<any>(`${this.baseUrl}/search/tv`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => (res.results || []).map((item: any) => this.mapShow(item))),
      catchError(err => {
        console.error('TMDB search error:', err);
        return of([]);
      })
    );
  }

  /**
   * Fetches full details for a single TV show from TMDB, including its seasons,
   * streaming watch providers, official videos/trailers, recommendations, and reviews.
   * Cached in-memory for instant modal loads.
   * @param showId - The TMDB show ID.
   * @returns An observable emitting the TVShow or null on error.
   */
  getShowDetails(showId: number): Observable<TVShow | null> {
    if (this.showDetailsCache.has(showId)) {
      return of(this.showDetailsCache.get(showId)!);
    }

    const params = this.createParams({
      language: 'en-US',
      append_to_response: 'watch/providers,videos,recommendations,reviews,credits',
      include_video_language: 'en,null,es'
    });

    return this.http.get<any>(`${this.baseUrl}/tv/${showId}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(details => {
        if (!details) return null;

        const now = new Date();
        const seasons: Season[] = (details.seasons || [])
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => {
            const hasAired = s.air_date ? new Date(s.air_date) <= now : (s.episode_count > 0);
            return {
              season_number: s.season_number,
              episode_count: s.episode_count || 10,
              air_date: s.air_date || null,
              is_aired: hasAired
            };
          });

        const mapped = this.mapShow(details);
        mapped.seasons = seasons;
        mapped.number_of_seasons = seasons.length || details.number_of_seasons || 1;
        mapped.summary = details.overview || '';
        mapped.status = details.status || null;
        if (details.genres && Array.isArray(details.genres)) {
          mapped.genres = details.genres.map((g: any) => g.name);
        }

        // Networks
        if (details.networks && Array.isArray(details.networks)) {
          mapped.networks = details.networks.map((n: any) => ({
            id: n.id,
            name: n.name,
            logo_path: n.logo_path ? `${this.imageBaseUrl}/w92${n.logo_path}` : null
          }));
        }

        // Cast & Crew
        if (details.credits?.cast && Array.isArray(details.credits.cast)) {
          mapped.cast = details.credits.cast.slice(0, 12).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character || 'Unknown',
            profile_path: c.profile_path ? `${this.imageBaseUrl}/w185${c.profile_path}` : null
          }));
        } else {
          mapped.cast = [];
        }

        // 1. Streaming Providers by Country
        const userCountry = this.getUserCountryCode();
        const wpResults = details['watch/providers']?.results;
        const allProviders: Record<string, WatchProvider[]> = {};
        if (wpResults) {
          for (const cCode of Object.keys(wpResults)) {
            const reg = wpResults[cCode];
            if (reg && reg.flatrate && Array.isArray(reg.flatrate)) {
              allProviders[cCode] = reg.flatrate.map((p: any) => ({
                provider_id: p.provider_id,
                provider_name: p.provider_name,
                logo_path: `${this.imageBaseUrl}/w154${p.logo_path}`,
                display_priority: p.display_priority
              }));
            }
          }
        }
        mapped.all_watch_providers = allProviders;
        mapped.watch_providers = allProviders[userCountry] || allProviders['ES'] || allProviders['US'] || Object.values(allProviders)[0] || [];

        // 2. Videos / Official YouTube Trailers
        if (details.videos?.results && Array.isArray(details.videos.results)) {
          const ytVideos = details.videos.results.filter((v: any) => v.site === 'YouTube');
          const trailers = ytVideos.filter((v: any) => v.type === 'Trailer' || v.type === 'Teaser');
          const chosen = trailers.length > 0 ? trailers : ytVideos;

          mapped.videos = chosen.map((v: any) => ({
            id: v.id,
            key: v.key,
            name: v.name,
            site: v.site,
            type: v.type,
            official: v.official || false
          }));
        } else {
          mapped.videos = [];
        }

        // 3. Recommendations
        if (details.recommendations?.results && Array.isArray(details.recommendations.results)) {
          mapped.recommendations = details.recommendations.results
            .slice(0, 10)
            .map((r: any) => this.mapShow(r));
        } else {
          mapped.recommendations = [];
        }

        // 4. Reviews
        if (details.reviews?.results && Array.isArray(details.reviews.results)) {
          mapped.reviews = details.reviews.results
            .slice(0, 8)
            .map((rev: any) => ({
              id: rev.id,
              author: rev.author,
              content: rev.content,
              created_at: rev.created_at ? rev.created_at.slice(0, 10) : '',
              rating: rev.author_details?.rating || null,
              avatar_path: rev.author_details?.avatar_path ? (
                rev.author_details.avatar_path.startsWith('/http') 
                  ? rev.author_details.avatar_path.slice(1) 
                  : `${this.imageBaseUrl}/w185${rev.author_details.avatar_path}`
              ) : null
            }));
        } else {
          mapped.reviews = [];
        }

        this.showDetailsCache.set(showId, mapped);
        return mapped;
      }),
      catchError(err => {
        console.error('TMDB show details error:', err);
        return of(null);
      })
    );
  }

  private topRatedShowsCacheByType = new Map<string, TVShow[]>();

  /**
   * Fetches the Top 250 highest-rated TV shows of all time from TMDB.
   * Can be filtered by format: 'all', 'miniseries' (with_type=2), or 'series' (with_type=4).
   * Uses vote_count.gte threshold to ensure high-quality, reputable ranking.
   * Assigns rank #1 to #250.
   */
  getTop250Shows(typeFilter: 'all' | 'miniseries' | 'series' = 'all'): Observable<TVShow[]> {
    const cacheKey = typeFilter || 'all';
    if (this.topRatedShowsCacheByType.has(cacheKey)) {
      return of(this.topRatedShowsCacheByType.get(cacheKey)!);
    }

    const pages = Array.from({ length: 13 }, (_, i) => i + 1);
    const requests = pages.map(page => {
      let params = new HttpParams()
        .set('language', 'en-US')
        .set('sort_by', 'vote_average.desc')
        .set('vote_count.gte', typeFilter === 'miniseries' ? '100' : '200')
        .set('page', page.toString());

      if (typeFilter === 'miniseries') {
        params = params.set('with_type', '2');
      } else if (typeFilter === 'series') {
        params = params.set('with_type', '4');
      }

      params = this.addAuthParams(params);

      return this.http.get<any>(`${this.baseUrl}/discover/tv`, {
        headers: this.getHeaders(),
        params
      }).pipe(
        map(res => res.results || []),
        catchError(() => of([]))
      );
    });

    return forkJoin(requests).pipe(
      map(pagesResults => {
        const rawShows = pagesResults.flat();
        const seenIds = new Set<number>();
        const uniqueShows = rawShows.filter(show => {
          if (!show.poster_path || seenIds.has(show.id)) return false;
          seenIds.add(show.id);
          return true;
        });

        const top250 = uniqueShows.slice(0, 250).map((raw, index) => {
          const show = this.mapShow(raw);
          show.rank = index + 1;
          return show;
        });

        this.topRatedShowsCacheByType.set(cacheKey, top250);
        return top250;
      }),
      catchError(err => {
        console.error('TMDB top 250 error:', err);
        return of([]);
      })
    );
  }

  /**
   * Discovers TV shows with full pagination and multi-filter criteria.
   * Cached in-memory for instant page turns.
   */
  discoverShows(options: {
    page?: number;
    sortBy?: string;
    providerId?: number | null;
    genreName?: string | null;
    genreNames?: string[] | null;
    decade?: string | null;
    minRating?: number | null;
    typeFilter?: 'all' | 'miniseries' | 'series' | null;
  }): Observable<{ page: number; totalPages: number; totalResults: number; shows: TVShow[] }> {
    const cacheKey = JSON.stringify(options);
    if (this.discoverCache.has(cacheKey)) {
      return of(this.discoverCache.get(cacheKey)!);
    }

    const page = options.page || 1;
    let params = new HttpParams()
      .set('language', 'en-US')
      .set('page', page.toString())
      .set('sort_by', options.sortBy || 'popularity.desc');

    if (options.typeFilter === 'miniseries') {
      params = params.set('with_type', '2');
    } else if (options.typeFilter === 'series') {
      params = params.set('with_type', '4');
    }

    if (options.providerId) {
      params = params
        .set('with_watch_providers', options.providerId.toString())
        .set('watch_region', this.getUserCountryCode());
    }
    if (options.genreNames && options.genreNames.length > 0) {
      const genreIds = options.genreNames.map(name => {
        return Object.keys(TMDB_GENRES).find(k => TMDB_GENRES[+k].toLowerCase() === name.toLowerCase());
      }).filter(Boolean);
      if (genreIds.length > 0) {
        params = params.set('with_genres', genreIds.join(','));
      }
    } else if (options.genreName) {
      const genreId = Object.keys(TMDB_GENRES).find(k => TMDB_GENRES[+k].toLowerCase() === options.genreName?.toLowerCase());
      if (genreId) {
        params = params.set('with_genres', genreId);
      }
    }
    if (options.decade) {
      if (options.decade === '2020s') params = params.set('first_air_date.gte', '2020-01-01');
      if (options.decade === '2010s') params = params.set('first_air_date.gte', '2010-01-01').set('first_air_date.lte', '2019-12-31');
      if (options.decade === '2000s') params = params.set('first_air_date.gte', '2000-01-01').set('first_air_date.lte', '2009-12-31');
      if (options.decade === '1990s') params = params.set('first_air_date.gte', '1990-01-01').set('first_air_date.lte', '1999-12-31');
      if (options.decade === 'Older') params = params.set('first_air_date.lte', '1989-12-31');
    }
    if (options.minRating) {
      params = params.set('vote_average.gte', options.minRating.toString()).set('vote_count.gte', '50');
    }

    params = this.addAuthParams(params);

    return this.http.get<any>(`${this.baseUrl}/discover/tv`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => {
        if (!res || !res.results) return { page: 1, totalPages: 1, totalResults: 0, shows: [] };
        const result = {
          page: res.page || 1,
          totalPages: Math.min(res.total_pages || 1, 500),
          totalResults: res.total_results || 0,
          shows: res.results.filter((i: any) => i.poster_path).map((i: any) => this.mapShow(i))
        };
        this.discoverCache.set(cacheKey, result);
        return result;
      }),
      catchError(err => {
        console.error('TMDB discover error:', err);
        return of({ page: 1, totalPages: 1, totalResults: 0, shows: [] });
      })
    );
  }

  /**
   * Discovers TV shows filtered by a streaming watch provider (e.g. Netflix = 8, Max = 1899, Disney+ = 337).
   * @param providerId - The TMDB watch provider ID.
   * @param page - Results page number.
   * @returns An observable emitting an array of TVShow objects.
   */
  getShowsByProvider(providerId: number, page = 1): Observable<TVShow[]> {
    let params = new HttpParams()
      .set('language', 'en-US')
      .set('with_watch_providers', providerId.toString())
      .set('watch_region', this.getUserCountryCode())
      .set('sort_by', 'popularity.desc')
      .set('page', page.toString());
    params = this.addAuthParams(params);

    return this.http.get<any>(`${this.baseUrl}/discover/tv`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => {
        if (!res || !res.results) return [];
        return res.results.map((item: any) => this.mapShow(item));
      }),
      catchError(err => {
        console.error('TMDB discover by provider error:', err);
        return of([]);
      })
    );
  }

  /** Legacy method for top rated shows, delegates to getTop250Shows. */
  getTopRatedShows(): Observable<TVShow[]> {
    return this.getTop250Shows();
  }

  /**
   * Fetches the trending TV shows of the week from TMDB (cached in-memory).
   * @returns An observable emitting an array of trending TVShow objects.
   */
  getTrendingShows(): Observable<TVShow[]> {
    if (this.trendingCache && this.trendingCache.length > 0) {
      return of(this.trendingCache);
    }

    let params = new HttpParams().set('language', 'en-US');
    params = this.addAuthParams(params);

    return this.http.get<any>(`${this.baseUrl}/trending/tv/week`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => {
        const results = res.results || [];
        const mapped = results.map((item: any) => this.mapShow(item));
        this.trendingCache = mapped;
        return mapped;
      }),
      catchError(err => {
        console.error('TMDB trending error:', err);
        return of([]);
      })
    );
  }

  /**
   * Fetches recently aired or upcoming episodes for a given show.
   * Checks both last_episode_to_air and next_episode_to_air from TMDB.
   * @param showId - The TMDB show ID.
   * @param withinDays - How many days back to include for recent episodes (default: 30).
   * @returns An observable emitting an array of NewEpisodeInfo.
   */
  getRecentEpisodes(showId: number, withinDays = 30): Observable<NewEpisodeInfo[]> {
    let params = new HttpParams().set('language', 'en-US');
    params = this.addAuthParams(params);

    return this.http.get<any>(`${this.baseUrl}/tv/${showId}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(details => {
        if (!details) return [];
        const episodes: NewEpisodeInfo[] = [];
        const now = new Date();

        // 1. Check next_episode_to_air (upcoming episodes)
        if (details.next_episode_to_air && details.next_episode_to_air.air_date) {
          const nextEp = details.next_episode_to_air;
          episodes.push({
            season: nextEp.season_number,
            number: nextEp.episode_number,
            name: nextEp.name || `Episode ${nextEp.episode_number}`,
            airdate: nextEp.air_date,
            overview: nextEp.overview || '',
            isUpcoming: true
          });
        }

        // 2. Check last_episode_to_air (recently aired in the last 30 days)
        if (details.last_episode_to_air && details.last_episode_to_air.air_date) {
          const lastEp = details.last_episode_to_air;
          const airDate = new Date(lastEp.air_date);
          const diffDays = (now.getTime() - airDate.getTime()) / (1000 * 3600 * 24);

          if (diffDays >= 0 && diffDays <= withinDays) {
            episodes.push({
              season: lastEp.season_number,
              number: lastEp.episode_number,
              name: lastEp.name || `Episode ${lastEp.episode_number}`,
              airdate: lastEp.air_date,
              overview: lastEp.overview || '',
              isUpcoming: false
            });
          }
        }

        return episodes;
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetches full season details including individual episodes from TMDB.
   * Cached in-memory to prevent duplicate requests.
   * @param showId - The TMDB TV show ID.
   * @param seasonNumber - The season number (e.g. 1, 2...).
   */
  getSeasonDetails(showId: number, seasonNumber: number): Observable<SeasonDetail | null> {
    const key = `${showId}_s${seasonNumber}`;
    if (this.seasonDetailsCache.has(key)) {
      return of(this.seasonDetailsCache.get(key)!);
    }

    const params = this.createParams({ language: 'en-US' });

    return this.http.get<any>(`${this.baseUrl}/tv/${showId}/season/${seasonNumber}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => {
        if (!res) return null;
        const episodes: EpisodeDetail[] = (res.episodes || []).map((ep: any) => ({
          id: ep.id,
          episode_number: ep.episode_number,
          season_number: ep.season_number,
          name: ep.name || `Episode ${ep.episode_number}`,
          overview: ep.overview || '',
          air_date: ep.air_date || null,
          runtime: ep.runtime || null,
          still_path: ep.still_path ? `${this.imageBaseUrl}/w300${ep.still_path}` : null,
          vote_average: ep.vote_average != null ? Math.round(ep.vote_average * 10) / 10 : null,
          vote_count: ep.vote_count || 0,
          episode_type: ep.episode_type || 'standard'
        }));

        const detail: SeasonDetail = {
          id: res.id,
          season_number: res.season_number,
          name: res.name || `Season ${res.season_number}`,
          overview: res.overview || '',
          poster_path: res.poster_path ? `${this.imageBaseUrl}/w500${res.poster_path}` : null,
          air_date: res.air_date || null,
          episodes
        };

        this.seasonDetailsCache.set(key, detail);
        return detail;
      }),
      catchError(err => {
        console.error(`Error fetching season ${seasonNumber} for show ${showId}:`, err);
        return of(null);
      })
    );
  }

  /**
   * Fetches top popular TV shows scheduled to air between the given date range.
   * Filtered and sorted strictly by popularity descending.
   */
  getTopUpcomingPopularShows(startDate: string, endDate: string): Observable<TVShow[]> {
    const params = this.createParams({
      language: 'en-US',
      sort_by: 'popularity.desc',
      'air_date.gte': startDate,
      'air_date.lte': endDate
    });

    return this.http.get<any>(`${this.baseUrl}/discover/tv`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => (res?.results || []).filter((s: any) => s.poster_path).map((s: any) => this.mapShow(s))),
      catchError(() => of([]))
    );
  }

  /**
   * Fetches TV shows airing today globally.
   * @param page - Page number (default: 1).
   */
  getAiringTodayShows(page = 1): Observable<{ shows: TVShow[]; totalPages: number }> {
    const params = this.createParams({ language: 'en-US', page });

    return this.http.get<any>(`${this.baseUrl}/tv/airing_today`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => ({
        shows: (res?.results || []).filter((s: any) => s.poster_path).map((s: any) => this.mapShow(s)),
        totalPages: Math.min(res?.total_pages || 1, 20)
      })),
      catchError(() => of({ shows: [], totalPages: 1 }))
    );
  }

  /**
   * Fetches TV shows currently on the air (airing within the next 7 days).
   * @param page - Page number (default: 1).
   */
  getOnTheAirShows(page = 1): Observable<{ shows: TVShow[]; totalPages: number }> {
    const params = this.createParams({ language: 'en-US', page });

    return this.http.get<any>(`${this.baseUrl}/tv/on_the_air`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(res => ({
        shows: (res?.results || []).filter((s: any) => s.poster_path).map((s: any) => this.mapShow(s)),
        totalPages: Math.min(res?.total_pages || 1, 20)
      })),
      catchError(() => of({ shows: [], totalPages: 1 }))
    );
  }

  /**
   * Maps a raw TMDB API response object to the internal TVShow model.
   * @param item - Raw show object from TMDB.
   * @returns A normalized TVShow object.
   */
  private mapShow(item: any): TVShow {
    const poster = item.poster_path
      ? `${this.imageBaseUrl}/w500${item.poster_path}`
      : 'https://via.placeholder.com/210x295/1e293b/6366f1?text=No+Image';

    let runtime = 45;
    if (Array.isArray(item.episode_run_time) && item.episode_run_time.length > 0) {
      runtime = Number(item.episode_run_time[0]) || 45;
    } else if (typeof item.episode_run_time === 'number' && item.episode_run_time > 0) {
      runtime = item.episode_run_time;
    }

    let genres: string[] = [];
    if (Array.isArray(item.genres) && item.genres.length > 0) {
      genres = item.genres.map((g: any) => g.name || g);
    } else if (Array.isArray(item.genre_ids)) {
      genres = item.genre_ids.map((id: number) => TMDB_GENRES[id] || '').filter(Boolean);
    }

    const voteAvg = item.vote_average != null ? Math.round(item.vote_average * 10) / 10 : null;

    const backdrop = item.backdrop_path
      ? `${this.imageBaseUrl}/original${item.backdrop_path}`
      : null;

    return {
      id: item.id,
      name: item.name || item.original_name || 'Untitled Show',
      poster_path: poster,
      backdrop_path: backdrop,
      first_air_date: item.first_air_date || '',
      number_of_seasons: item.number_of_seasons || (item.seasons ? item.seasons.length : 0),
      episode_run_time: runtime,
      rating: voteAvg,
      seasons: [],
      summary: item.overview || '',
      genres
    };
  }

  /**
   * Fetches full biographical profile, social media IDs, and TV filmography for a person.
   * @param personId - TMDB person ID.
   */
  getPersonDetails(personId: number): Observable<PersonDetail> {
    if (this.personDetailsCache.has(personId)) {
      return of(this.personDetailsCache.get(personId)!);
    }

    const params = this.createParams({
      append_to_response: 'tv_credits,external_ids',
      language: 'es-ES'
    });

    return this.http.get<any>(`${this.baseUrl}/person/${personId}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(data => {
        const mapCredit = (item: any): PersonTvCreditShow => ({
          id: item.id,
          name: item.name || item.original_name || 'Untitled',
          character: item.character || undefined,
          job: item.job || undefined,
          department: item.department || undefined,
          episode_count: item.episode_count || undefined,
          first_air_date: item.first_air_date || '',
          poster_path: item.poster_path ? `${this.imageBaseUrl}/w342${item.poster_path}` : null,
          backdrop_path: item.backdrop_path ? `${this.imageBaseUrl}/w780${item.backdrop_path}` : null,
          vote_average: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
          vote_count: item.vote_count || 0,
          popularity: item.popularity || 0,
          overview: item.overview || '',
          genre_ids: item.genre_ids || []
        });

        const rawCast = Array.isArray(data.tv_credits?.cast) ? data.tv_credits.cast : [];
        const rawCrew = Array.isArray(data.tv_credits?.crew) ? data.tv_credits.crew : [];

        // Deduplicate credits by ID (if an actor played in multiple seasons or roles, combine episode counts)
        const castMap = new Map<number, PersonTvCreditShow>();
        for (const c of rawCast) {
          if (!castMap.has(c.id)) {
            castMap.set(c.id, mapCredit(c));
          } else {
            const existing = castMap.get(c.id)!;
            if (c.episode_count && existing.episode_count) {
              existing.episode_count += c.episode_count;
            }
          }
        }

        const crewMap = new Map<number, PersonTvCreditShow>();
        for (const c of rawCrew) {
          if (!crewMap.has(c.id)) {
            crewMap.set(c.id, mapCredit(c));
          }
        }

        const cast = Array.from(castMap.values()).sort((a, b) => b.popularity - a.popularity);
        const crew = Array.from(crewMap.values()).sort((a, b) => b.popularity - a.popularity);

        const person: PersonDetail = {
          id: data.id,
          name: data.name,
          biography: data.biography || '',
          birthday: data.birthday || null,
          deathday: data.deathday || null,
          place_of_birth: data.place_of_birth || null,
          profile_path: data.profile_path ? `${this.imageBaseUrl}/h632${data.profile_path}` : null,
          known_for_department: data.known_for_department || 'Acting',
          popularity: Math.round((data.popularity || 0) * 10) / 10,
          homepage: data.homepage || null,
          external_ids: {
            imdb_id: data.external_ids?.imdb_id || null,
            instagram_id: data.external_ids?.instagram_id || null,
            twitter_id: data.external_ids?.twitter_id || null,
            facebook_id: data.external_ids?.facebook_id || null,
            tiktok_id: data.external_ids?.tiktok_id || null,
            wikidata_id: data.external_ids?.wikidata_id || null
          },
          tv_credits: { cast, crew }
        };

        this.personDetailsCache.set(personId, person);
        return person;
      }),
      catchError(err => {
        console.error('Error fetching person details from TMDB:', err);
        return of({
          id: personId,
          name: 'Unknown',
          biography: '',
          birthday: null,
          deathday: null,
          place_of_birth: null,
          profile_path: null,
          known_for_department: 'Acting',
          popularity: 0,
          homepage: null,
          external_ids: {},
          tv_credits: { cast: [], crew: [] }
        } as PersonDetail);
      })
    );
  }
}
