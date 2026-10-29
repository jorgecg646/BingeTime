import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TVShow } from '../models';
import { TmdbService } from './tmdb.service';

describe('TmdbService', () => {
  let service: TmdbService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TmdbService
      ]
    });
    service = TestBed.inject(TmdbService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns no results for an empty search without making a request', () => {
    let results: unknown;
    service.searchShows('   ').subscribe(value => results = value);

    expect(results).toEqual([]);
    http.expectNone(request => request.url.includes('/search/tv'));
  });

  it('merges localized search results and ranks an exact title first', () => {
    let results: { id: number; name: string; localized_name?: string }[] = [];
    service.searchShows('Severance').subscribe(value => results = value);

    const requests = http.match(request => request.url.includes('/search/tv'));
    expect(requests.length).toBe(2);
    requests.find(request => request.request.params.get('language') === 'en-US')!.flush({
      results: [
        { id: 2, name: 'Severance: Aftershow', popularity: 100 },
        { id: 1, name: 'Severance', popularity: 10 }
      ]
    });
    requests.find(request => request.request.params.get('language') === 'es-ES')!.flush({
      results: [{ id: 1, name: 'Separación', popularity: 10 }]
    });

    expect(results.map(show => show.id)).toEqual([1, 2]);
    expect(results[0].localized_name).toBe('Separación');
  });

  it('caches successful show details by show ID', () => {
    const details = {
      id: 123,
      name: 'Example',
      seasons: [{ season_number: 1, episode_count: 8, air_date: '2020-01-01' }],
      'watch/providers': {
        results: {
          US: { flatrate: [{ provider_id: 1, provider_name: 'US service', logo_path: '/us.png' }] },
          ES: { flatrate: [{ provider_id: 2, provider_name: 'ES service', logo_path: '/es.png' }] }
        }
      }
    };
    service.setCountry('US');
    const firstResults: (TVShow | null)[] = [];
    service.getShowDetails(123).subscribe(value => firstResults.push(value));
    http.expectOne(request => request.url.endsWith('/tv/123')).flush(details);

    service.setCountry('ES');
    const cachedResults: (TVShow | null)[] = [];
    service.getShowDetails(123).subscribe(value => cachedResults.push(value));

    expect(firstResults[0]?.id).toBe(123);
    expect(firstResults[0]?.watch_providers?.[0].provider_id).toBe(1);
    expect(cachedResults[0]?.id).toBe(firstResults[0]?.id);
    expect(cachedResults[0]?.watch_providers?.[0].provider_id).toBe(2);
    http.expectNone(request => request.url.endsWith('/tv/123'));
  });

  it('invalidates provider discovery results when the selected country changes', () => {
    const options = { page: 1, providerId: 8 };
    service.setCountry('US');
    service.discoverShows(options).subscribe();
    const usRequest = http.expectOne(request => request.url.endsWith('/discover/tv'));
    expect(usRequest.request.params.get('watch_region')).toBe('US');
    usRequest.flush({ page: 1, results: [] });

    service.discoverShows(options).subscribe();
    http.expectNone(request => request.url.endsWith('/discover/tv'));

    service.setCountry('ES');
    service.discoverShows(options).subscribe();
    const esRequest = http.expectOne(request => request.url.endsWith('/discover/tv'));
    expect(esRequest.request.params.get('watch_region')).toBe('ES');
    esRequest.flush({ page: 1, results: [] });
  });

  it('does not cache an incomplete Top 250 response after one page fails', () => {
    spyOn(console, 'error');
    const results: TVShow[][] = [];
    service.getTop250Shows().subscribe(value => results.push(value));
    const firstPageRequests = http.match(request => request.url.endsWith('/discover/tv'));
    expect(firstPageRequests.length).toBe(13);

    firstPageRequests.slice(0, 12).forEach(request => request.flush({ results: [] }));
    firstPageRequests[12].flush(
      { status_message: 'Unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );
    expect(results).toEqual([[]]);
    expect(service.apiError()).toBe(
      'TMDB data could not be loaded. Check your connection and try again.'
    );

    service.getTop250Shows().subscribe();
    const retryRequests = http.match(request => request.url.endsWith('/discover/tv'));
    expect(retryRequests.length).toBe(13);
    retryRequests.forEach(request => request.flush({ results: [] }));
  });

  it('emits null when the show details request fails', () => {
    spyOn(console, 'error');
    let result: unknown = 'pending';
    service.getShowDetails(404).subscribe(value => result = value);
    http.expectOne(request => request.url.endsWith('/tv/404')).flush(
      { status_message: 'Not found' },
      { status: 404, statusText: 'Not Found' }
    );

    expect(result).toBeNull();
    expect(service.apiError()).toBe(
      'TMDB data could not be loaded. Check your connection and try again.'
    );
    expect(console.error).toHaveBeenCalledWith(
      'TMDB show details request failed (HTTP 404).'
    );
    service.dismissApiError();
    expect(service.apiError()).toBeNull();
  });
});
