import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { TVShow } from '../models';
import { AuthService } from './auth.service';
import { ShowStateService } from './show-state.service';
import { SupabaseService } from './supabase.service';
import { TmdbService } from './tmdb.service';

describe('ShowStateService', () => {
  let service: ShowStateService;
  let authUser: WritableSignal<{ id: string } | null>;
  let getAllShows: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    authUser = signal<{ id: string } | null>(null);
    getAllShows = jasmine.createSpy('getAllShows');
  });

  function createService(): void {
    TestBed.configureTestingModule({
      providers: [
        ShowStateService,
        { provide: TmdbService, useValue: { searchShows: () => of([]) } },
        {
          provide: AuthService,
          useValue: { isRestoringSession: signal(false), user: authUser }
        },
        { provide: SupabaseService, useValue: { getAllShows } }
      ]
    });
    service = TestBed.inject(ShowStateService);
  }

  it('adds a watched show, calculates its episodes and persists the watchlist', () => {
    const show: TVShow = {
      id: 10,
      name: 'Example',
      poster_path: null,
      first_air_date: '2020-01-01',
      number_of_seasons: 2,
      episode_run_time: 30,
      rating: 8,
      seasons: [
        { season_number: 1, episode_count: 8 },
        { season_number: 2, episode_count: 10 }
      ]
    };
    createService();

    service.addWatchedShow(show, 2);

    expect(service.watchedShows().length).toBe(1);
    expect(service.watchedShows()[0].episodesWatched).toBe(18);
    expect(service.watchedShows()[0].totalMinutes).toBe(540);
    expect(JSON.parse(localStorage.getItem('watchedShows') || '[]')).toEqual(service.watchedShows());
  });

  it('removes a show from the pending list when it becomes watched', () => {
    const show: TVShow = {
      id: 10,
      name: 'Example',
      poster_path: null,
      first_air_date: '2020-01-01',
      number_of_seasons: 1,
      episode_run_time: 30,
      rating: 8,
      seasons: [{ season_number: 1, episode_count: 8 }]
    };
    localStorage.setItem('pendingShows', JSON.stringify([
      { id: '10_p_1', show, addedAt: 1 }
    ]));
    createService();

    service.addWatchedShow(show, 1);

    expect(service.pendingShows()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('pendingShows') || '[]')).toEqual([]);
  });

  it('recovers from malformed persisted watchlist data', () => {
    localStorage.setItem('watchedShows', '{malformed');
    createService();

    expect(service.watchedShows()).toEqual([]);
  });

  it('keeps local shows and shows a safe notice when cloud loading fails', async () => {
    const show: TVShow = {
      id: 10,
      name: 'Example',
      poster_path: null,
      first_air_date: '2020-01-01',
      number_of_seasons: 1,
      episode_run_time: 30,
      rating: 8,
      seasons: [{ season_number: 1, episode_count: 8 }]
    };
    const watched = {
      instanceId: '10_1700000000000_abc',
      show,
      seasonsWatched: 1,
      totalMinutes: 240,
      episodesWatched: 8,
      userRating: 0,
      addedAt: 1700000000000
    };
    localStorage.setItem('watchedShows', JSON.stringify([watched]));
    getAllShows.and.returnValue(Promise.reject(new Error('private response body')));
    spyOn(console, 'error');
    createService();
    authUser.set({ id: 'user-1' });
    TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.watchedShows()).toEqual([watched]);
    expect(service.syncError()).toContain('still available in this browser');
    expect(service.syncError()).not.toContain('private response body');
    expect(console.error).toHaveBeenCalledWith(
      'Cloud sync failed while loading your show list.'
    );
  });
});
