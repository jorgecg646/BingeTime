import { Component, signal, computed, inject, effect, OnInit, OnDestroy, HostListener } from '@angular/core';
import { SlicePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TVShow, WatchedShow, PendingShow } from './models';
import { TvmazeService } from './services/tvmaze.service';
import { CounterComponent } from './components/counter/counter.component';
import { YourShowsComponent } from './components/your-shows/your-shows.component';
import { TrendingComponent } from './components/trending/trending.component';
import { PendingShowsComponent } from './components/pending-shows/pending-shows.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SlicePipe, NgTemplateOutlet, FormsModule, CounterComponent, YourShowsComponent, TrendingComponent, PendingShowsComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  private tvmaze = inject(TvmazeService);

  watchedShows = signal<WatchedShow[]>(this.loadFromStorage());
  pendingShows = signal<PendingShow[]>(this.loadPendingFromStorage());
  activeShowForDetails = signal<TVShow | null>(null);

  searchQuery = '';
  searchResults: TVShow[] = [];
  showDropdown = false;
  isLoading = false;

  selectedShow: TVShow | null = null;
  seasonsToAdd = 0;
  ratingOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Search inline dropdown
  activeSearchDropdownShow = signal<TVShow | null>(null);
  searchDropdownSeasonsToAdd = 0;
  searchDropdownLoading = false;

  // Full search results page
  searchPageResults = signal<TVShow[] | null>(null);
  searchPageQuery = '';
  isSearchPageLoading = false;

  // Top Rated Shows Page
  topRatedPageActive = signal<boolean>(false);
  topRatedShows = signal<TVShow[]>([]);
  topRatedCurrentPage = signal<number>(1);
  selectedGenre = signal<string | null>(null);
  selectedDecade = signal<string | null>(null);
  selectedRatingMin = signal<number | null>(null);
  activeFilterDropdown = signal<'genre' | 'year' | 'rating' | null>(null);

  filteredTopRatedShows = computed(() => {
    let shows = this.topRatedShows();
    
    // Filter by genre
    const genre = this.selectedGenre();
    if (genre) {
      shows = shows.filter(s => s.genres?.includes(genre));
    }
    
    // Filter by decade
    const decade = this.selectedDecade();
    if (decade) {
      shows = shows.filter(s => {
        const year = parseInt(s.first_air_date?.slice(0, 4));
        if (isNaN(year)) return false;
        if (decade === '2020s') return year >= 2020;
        if (decade === '2010s') return year >= 2010 && year < 2020;
        if (decade === '2000s') return year >= 2000 && year < 2010;
        if (decade === '1990s') return year >= 1990 && year < 2000;
        if (decade === 'Older') return year < 1990;
        return true;
      });
    }
    
    // Filter by rating
    const rating = this.selectedRatingMin();
    if (rating) {
      shows = shows.filter(s => s.rating !== null && s.rating >= rating);
    }
    
    return shows;
  });

  topRatedTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredTopRatedShows().length / 49)));
  topRatedPageShows = computed(() => {
    const page = this.topRatedCurrentPage();
    const shows = this.filteredTopRatedShows();
    return shows.slice((page - 1) * 49, page * 49);
  });

  topRatedRangeStart = computed(() => {
    const total = this.filteredTopRatedShows().length;
    if (total === 0) return 0;
    return (this.topRatedCurrentPage() - 1) * 49 + 1;
  });

  topRatedRangeEnd = computed(() => {
    return Math.min(this.topRatedCurrentPage() * 49, this.filteredTopRatedShows().length);
  });

  // Background images derived from user's watchlist
  bgImages = computed(() => {
    const shows = this.watchedShows();
    const defaultImage = 'https://static.tvmaze.com/uploads/images/original_untouched/501/1253519.jpg';
    if (shows.length === 0) {
      return [defaultImage];
    }
    return shows
      .map(w => w.show.poster_path)
      .filter((path): path is string => !!path)
      .map(path => path.replace('medium_portrait', 'original_untouched'));
  });

  bgImage1 = signal<string>('');
  bgImage2 = signal<string>('');
  bg1Visible = signal<boolean>(true);
  private currentBgIndex = 0;
  private bgIntervalId: any;

  /* Derived totals */
  totalMinutes = computed(() => this.watchedShows().reduce((s, w) => s + w.totalMinutes, 0));
  totalEpisodes = computed(() => this.watchedShows().reduce((s, w) => s + w.episodesWatched, 0));
  days = computed(() => String(Math.floor(this.totalMinutes() / 1440)).padStart(2, '0'));
  hours = computed(() => String(Math.floor((this.totalMinutes() % 1440) / 60)).padStart(2, '0'));
  minutes = computed(() => String(this.totalMinutes() % 60).padStart(2, '0'));

  private modalStackCount = 0;

  private pushModalState(): void {
    history.pushState({ modalOpen: true, index: this.modalStackCount }, '');
    this.modalStackCount++;
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent) {
    if (this.modalStackCount > 0) {
      this.modalStackCount--;
    }
    this.closeLastOverlay();
  }

  private closeLastOverlay(): void {
    if (this.activeShowForDetails()) {
      this.activeShowForDetails.set(null);
    } else if (this.searchPageResults() !== null) {
      this.searchPageResults.set(null);
      this.searchQuery = '';
      this.searchPageQuery = '';
    } else if (this.topRatedPageActive()) {
      this.clearFiltersAndCloseTopRated();
    } else if (this.selectedShow) {
      this.selectedShow = null;
      this.seasonsToAdd = 0;
    }
  }

  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) return of([]);
        this.isLoading = true;
        return this.tvmaze.searchShows(query);
      })
    ).subscribe(results => {
      this.searchResults = results;
      this.isLoading = false;
    });

    // Effect to monitor changes in bgImages and sync the initial background or index
    effect(() => {
      const images = this.bgImages();
      if (this.currentBgIndex >= images.length) {
        this.currentBgIndex = 0;
      }

      // Update image sources dynamically when list changes
      if (images.length === 1) {
        this.bgImage1.set(images[0]);
        this.bg1Visible.set(true);
      } else if (images.length > 1 && !this.bgImage1() && !this.bgImage2()) {
        this.bgImage1.set(images[0]);
        this.bg1Visible.set(true);
      }
    });
  }

  ngOnInit() {
    const images = this.bgImages();
    if (images.length > 0) {
      this.bgImage1.set(images[0]);
    }
    this.startBgSlideshow();
  }

  openDetails(show: TVShow): void {
    this.pushModalState();
    if (show.summary) {
      this.activeShowForDetails.set(show);
    } else {
      this.isLoading = true;
      this.tvmaze.getShowDetails(show.id).subscribe(result => {
        this.isLoading = false;
        if (result) {
          this.activeShowForDetails.set(result);
        }
      });
    }
  }

  closeDetailsModal(): void {
    if (this.modalStackCount > 0) {
      history.back();
    } else {
      this.activeShowForDetails.set(null);
    }
  }

  addDetailsShowToWatched(): void {
    const show = this.activeShowForDetails();
    if (!show) return;
    this.closeDetailsModal();
    this.selectShow(show);
  }

  /* ---------------------- Pending Shows ---------------------- */
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

  removePending(id: string | number): void {
    const isNum = typeof id === 'number';
    this.pendingShows.update(list => list.filter(p => isNum ? p.show.id !== id : p.id !== id));
    this.savePending();
  }

  isInPending(showId: number): boolean {
    return this.pendingShows().some(p => p.show.id === showId);
  }

  addShowFromTrending(event: { show: TVShow; seasons: number }): void {
    const t = this.calculateTime(event.show, event.seasons);
    const newInstance: WatchedShow = {
      instanceId: event.show.id.toString() + '_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
      show: event.show,
      seasonsWatched: event.seasons,
      totalMinutes: t.minutes,
      episodesWatched: t.episodes,
      userRating: 0
    };
    this.watchedShows.update(list => [newInstance, ...list]);
    this.save();
  }

  movePendingToWatched(pending: PendingShow): void {
    this.removePending(pending.id);
    this.selectShow(pending.show);
  }

  getShowInstances(showId: number): WatchedShow[] {
    return this.watchedShows().filter(w => w.show.id === showId);
  }

  ngOnDestroy() {
    if (this.bgIntervalId) {
      clearInterval(this.bgIntervalId);
    }
  }

  private startBgSlideshow() {
    if (this.bgIntervalId) clearInterval(this.bgIntervalId);

    this.bgIntervalId = setInterval(() => {
      const images = this.bgImages();
      if (images.length <= 1) {
        if (images.length === 1) {
          this.bgImage1.set(images[0]);
          this.bg1Visible.set(true);
        }
        return;
      }

      this.currentBgIndex = (this.currentBgIndex + 1) % images.length;
      const nextImg = images[this.currentBgIndex];

      if (this.bg1Visible()) {
        this.bgImage2.set(nextImg);
        this.bg1Visible.set(false);
      } else {
        this.bgImage1.set(nextImg);
        this.bg1Visible.set(true);
      }
    }, 10000); // Cambia cada 10 segundos
  }

  /* ---------------------- Search UI ---------------------- */
  onSearchChange(query: string): void {
    this.searchSubject.next(query);
    // Close inline dropdown when query changes
    this.activeSearchDropdownShow.set(null);
    this.searchDropdownSeasonsToAdd = 0;
  }

  searchAll(): void {
    const query = this.searchQuery.trim();
    if (!query) return;
    this.pushModalState();
    this.searchPageQuery = query;
    this.isSearchPageLoading = true;
    this.searchPageResults.set([]);
    this.showDropdown = false;

    this.tvmaze.searchAllShows(query).subscribe({
      next: (results) => {
        this.searchPageResults.set(results);
        this.isSearchPageLoading = false;
      },
      error: () => {
        this.searchPageResults.set([]);
        this.isSearchPageLoading = false;
      }
    });
  }

  closeSearchPage(): void {
    if (this.modalStackCount > 0) {
      history.back();
    } else {
      this.searchPageResults.set(null);
      this.searchPageQuery = '';
    }
  }

  openTopRatedPage(): void {
    this.tvmaze.getTopRatedShows().subscribe(shows => {
      this.pushModalState();
      this.topRatedShows.set(shows);
      this.topRatedCurrentPage.set(1);
      this.topRatedPageActive.set(true);
    });
  }

  closeTopRatedPage(): void {
    if (this.modalStackCount > 0) {
      history.back();
    } else {
      this.clearFiltersAndCloseTopRated();
    }
  }

  private clearFiltersAndCloseTopRated(): void {
    this.topRatedPageActive.set(false);
    this.selectedGenre.set(null);
    this.selectedDecade.set(null);
    this.selectedRatingMin.set(null);
    this.activeFilterDropdown.set(null);
  }

  setFilter(type: 'genre' | 'decade' | 'rating', value: any): void {
    if (type === 'genre') this.selectedGenre.set(value);
    else if (type === 'decade') this.selectedDecade.set(value);
    else if (type === 'rating') this.selectedRatingMin.set(value);
    this.topRatedCurrentPage.set(1);
    this.activeFilterDropdown.set(null);
  }

  toggleSearchDropdown(show: TVShow, event: Event): void {
    event.stopPropagation();
    if (this.activeSearchDropdownShow()?.id === show.id) {
      this.activeSearchDropdownShow.set(null);
      this.searchDropdownSeasonsToAdd = 0;
      return;
    }
    this.searchDropdownLoading = true;
    this.activeSearchDropdownShow.set(null);
    this.tvmaze.getShowDetails(show.id).subscribe(result => {
      this.searchDropdownLoading = false;
      if (result) {
        this.activeSearchDropdownShow.set(result);
        this.searchDropdownSeasonsToAdd = 0;
      }
    });
  }

  get searchDropdownSeasonNumbers(): number[] {
    const show = this.activeSearchDropdownShow();
    if (!show?.number_of_seasons) return [];
    return Array.from({ length: show.number_of_seasons }, (_, i) => i + 1);
  }

  addSearchDropdownShow(): void {
    const show = this.activeSearchDropdownShow();
    if (!show || this.searchDropdownSeasonsToAdd === 0) return;
    
    const t = this.calculateTime(show, this.searchDropdownSeasonsToAdd);
    const newInstance: WatchedShow = {
      instanceId: show.id.toString() + '_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
      show: show,
      seasonsWatched: this.searchDropdownSeasonsToAdd,
      totalMinutes: t.minutes,
      episodesWatched: t.episodes,
      userRating: 0
    };
    this.watchedShows.update(list => [newInstance, ...list]);
    this.save();

    // Close search dropdown and reset state
    this.activeSearchDropdownShow.set(null);
    this.searchDropdownSeasonsToAdd = 0;
    this.showDropdown = false;
    this.searchQuery = '';
    this.searchResults = [];
  }

  selectShow(show: TVShow): void {
    this.isLoading = true;
    this.tvmaze.getShowDetails(show.id).subscribe(result => {
      this.isLoading = false;
      if (!result) return;
      this.pushModalState();
      this.selectedShow = result;
      this.seasonsToAdd = 0;
    });
  }

  get seasonNumbers(): number[] {
    if (!this.selectedShow?.number_of_seasons) return [];
    return Array.from({ length: this.selectedShow.number_of_seasons }, (_, i) => i + 1);
  }

  /* ---------------------- Time calc ---------------------- */
  private calculateTime(show: TVShow, seasonsWatched: number): { minutes: number; episodes: number } {
    const runtime = show.episode_run_time || 45;
    const episodes = show.seasons.length
      ? show.seasons.slice(0, seasonsWatched).reduce((sum, s) => sum + s.episode_count, 0)
      : seasonsWatched * 10;
    return { minutes: Math.round(episodes * runtime), episodes };
  }

  /* ---------------------- Mutations ---------------------- */
  addShow(): void {
    if (!this.selectedShow || this.seasonsToAdd === 0) return;
    const t = this.calculateTime(this.selectedShow, this.seasonsToAdd);
    const newInstance: WatchedShow = {
      instanceId: this.selectedShow.id.toString() + '_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
      show: this.selectedShow!,
      seasonsWatched: this.seasonsToAdd,
      totalMinutes: t.minutes,
      episodesWatched: t.episodes,
      userRating: 0
    };
    this.watchedShows.update(list => [newInstance, ...list]);
    this.save();
    this.closeModal();
    // Clear search only when show is successfully added
    this.searchQuery = '';
    this.searchResults = [];
    this.showDropdown = false;
  }

  changeSeason(item: WatchedShow, delta: number): void {
    const newSeasons = item.seasonsWatched + delta;
    if (newSeasons < 1 || newSeasons > item.show.number_of_seasons) return;
    const t = this.calculateTime(item.show, newSeasons);
    this.watchedShows.update(list => list.map(w =>
      w.instanceId === item.instanceId ? { ...w, seasonsWatched: newSeasons, totalMinutes: t.minutes, episodesWatched: t.episodes } : w
    ));
    this.save();
  }

  removeShow(instanceId: string): void {
    this.watchedShows.update(list => list.filter(w => w.instanceId !== instanceId));
    this.save();
  }

  setUserRating(item: WatchedShow, rating: number): void {
    this.watchedShows.update(list => list.map(w =>
      w.instanceId === item.instanceId ? { ...w, userRating: rating } : w
    ));
    this.save();
  }

  resetAll(): void {
    if (confirm('Are you sure you want to delete all shows?')) {
      this.watchedShows.set([]);
      this.pendingShows.set([]);
      this.save();
      this.savePending();
    }
  }

  closeModal(): void {
    if (this.modalStackCount > 0) {
      history.back();
    } else {
      this.selectedShow = null;
      this.seasonsToAdd = 0;
    }
  }


  /* ---------------------- Storage ---------------------- */
  private save(): void {
    localStorage.setItem('watchedShows', JSON.stringify(this.watchedShows()));
  }

  private savePending(): void {
    localStorage.setItem('pendingShows', JSON.stringify(this.pendingShows()));
  }

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

  private loadPendingFromStorage(): PendingShow[] {
    try {
      return JSON.parse(localStorage.getItem('pendingShows') || '[]');
    } catch {
      return [];
    }
  }
}
