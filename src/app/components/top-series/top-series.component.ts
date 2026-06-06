import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TVShow } from '../../models';
import { TvmazeService } from '../../services/tvmaze.service';
import { ShowStateService } from '../../services/show-state.service';

/**
 * Displays the Top 250 rated shows in a filterable, paginated grid.
 * Supports genre, decade, and minimum rating filters.
 * Each show card includes an inline quick-add season picker.
 */
@Component({
  selector: 'app-top-series',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink],
  template: `
    <div class="animate-fade-in relative z-10">
      <!-- Top header banner -->
      <div class="mb-8 border-b border-white/5 pb-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <a routerLink="/" class="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <div>
              <h2 class="text-3xl font-extrabold text-white tracking-tight">Top Rated Productions</h2>
              <p class="text-zinc-400 text-xs mt-1">Showing {{ topRatedRangeStart() }}-{{ topRatedRangeEnd() }} of {{ filteredTopRatedShows().length }} top rated productions</p>
            </div>
          </div>

          <!-- Advanced Filters -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Genre Filter -->
            <div class="relative">
              <button 
                (click)="activeFilterDropdown.set(activeFilterDropdown() === 'genre' ? null : 'genre')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs">
                <span>GENRE: {{ selectedGenre() || 'ALL' }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeFilterDropdown() === 'genre'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeFilterDropdown() === 'genre') {
                <div class="absolute left-0 mt-2 z-50 w-48 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl p-1 max-h-64 overflow-y-auto">
                  <button (click)="setFilter('genre', null)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5">All</button>
                  @for (genre of ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Science-Fiction', 'Thriller']; track genre) {
                    <button (click)="setFilter('genre', genre)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5" [class.text-blue-400]="selectedGenre() === genre">{{ genre }}</button>
                  }
                </div>
              }
            </div>

            <!-- Year Filter -->
            <div class="relative">
              <button 
                (click)="activeFilterDropdown.set(activeFilterDropdown() === 'year' ? null : 'year')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs">
                <span>YEAR: {{ selectedDecade() || 'ALL' }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeFilterDropdown() === 'year'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeFilterDropdown() === 'year') {
                <div class="absolute left-0 mt-2 z-50 w-40 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl p-1">
                  <button (click)="setFilter('decade', null)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5">All</button>
                  @for (dec of ['2020s', '2010s', '2000s', '1990s', 'Older']; track dec) {
                    <button (click)="setFilter('decade', dec)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5" [class.text-blue-400]="selectedDecade() === dec">{{ dec }}</button>
                  }
                </div>
              }
            </div>

            <!-- Rating Filter -->
            <div class="relative">
              <button 
                (click)="activeFilterDropdown.set(activeFilterDropdown() === 'rating' ? null : 'rating')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs">
                <span>RATING: {{ selectedRatingMin() ? '★ ' + selectedRatingMin() + '+' : 'ALL' }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeFilterDropdown() === 'rating'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeFilterDropdown() === 'rating') {
                <div class="absolute left-0 mt-2 z-50 w-40 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl p-1">
                  <button (click)="setFilter('rating', null)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5">All</button>
                  @for (rat of [9.0, 8.5, 8.0, 7.5]; track rat) {
                    <button (click)="setFilter('rating', rat)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5" [class.text-blue-400]="selectedRatingMin() === rat">★ {{ rat }}+</button>
                  }
                </div>
              }
            </div>
            
            <!-- Clear Filters Button -->
            @if (selectedGenre() || selectedDecade() || selectedRatingMin()) {
              <button 
                (click)="setFilter('genre', null); setFilter('decade', null); setFilter('rating', null)"
                class="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all font-bold text-[10px] uppercase flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                Clear Filters
              </button>
            }
          </div>

        </div>
      </div>

      <!-- Content Grid -->
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
        @for (show of topRatedPageShows(); track show.id; let i = $index) {
          <ng-container *ngTemplateOutlet="showCard; context: { show: show, index: i, delay: 15 }"></ng-container>
        }
      </div>

      <!-- Pagination -->
      @if (topRatedTotalPages() > 1) {
        <div class="mt-12 flex justify-center items-center gap-1.5">
          <!-- Previous page -->
          <button 
            [disabled]="topRatedCurrentPage() === 1"
            (click)="topRatedCurrentPage.set(topRatedCurrentPage() - 1)"
            class="p-2.5 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          
          <!-- Pages -->
          @for (p of getVisiblePages(); track p) {
            @if (p === -1) {
              <span class="px-2 text-zinc-600 font-bold select-none">...</span>
            } @else {
              <button 
                (click)="topRatedCurrentPage.set(p)"
                [class]="topRatedCurrentPage() === p ? 'bg-blue-600 border-blue-500 text-white font-bold' : 'border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'"
                class="w-10 h-10 rounded-xl border text-sm font-semibold transition-all">
                {{ p }}
              </button>
            }
          }

          <!-- Next page -->
          <button 
            [disabled]="topRatedCurrentPage() === topRatedTotalPages()"
            (click)="topRatedCurrentPage.set(topRatedCurrentPage() + 1)"
            class="p-2.5 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      }
    </div>

    <!-- Reusable Series Card Template -->
    <ng-template #showCard let-show="show" let-i="index" let-delay="delay">
      <div class="group cursor-pointer animate-slide-up" [style.animation-delay]="i * delay + 'ms'" (click)="state.openDetails(show)">
        <div class="relative aspect-[2/3] overflow-hidden rounded-xl shadow-md hover-lift mb-2">
          <img [src]="show.poster_path" [alt]="show.name" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          
          @if (state.isWatched(show.id)) {
            <div class="absolute top-2 left-2 w-7 h-7 bg-emerald-500/95 text-white rounded-full flex items-center justify-center border border-emerald-400/30 backdrop-blur-sm shadow-lg z-20 animate-fade-in" title="Watched">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
          } @else if (state.isInPending(show.id)) {
            <div class="absolute top-2 left-2 w-7 h-7 bg-violet-600/95 text-white rounded-full flex items-center justify-center border border-violet-500/30 backdrop-blur-sm shadow-lg z-20 animate-fade-in" title="Pending">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          }

          @if (show.rating !== null) {
            <div class="absolute top-2 right-2 px-2 py-0.5 bg-black/75 backdrop-blur-md rounded-md flex items-center gap-1 text-[11px] font-bold text-amber-400 border border-white/5">
              <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
              {{ show.rating }}
            </div>
          }
          
          <!-- Chevron button overlay -->
          <button
            (click)="toggleSearchDropdown(show, $event)"
            class="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white hover:text-blue-400 transition-all border border-white/10 z-40 flex items-center justify-center shadow-lg"
            title="Quick add">
            <svg class="w-3.5 h-3.5 transition-transform duration-200"
                 [class.rotate-180]="activeSearchDropdownShow()?.id === show.id"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>

          <!-- Hover overlay -->
          @if (activeSearchDropdownShow()?.id !== show.id) {
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-end p-2.5 pointer-events-none">
              <span class="text-white text-[11px] font-semibold">View details</span>
            </div>
          }

          <!-- Inline season dropdown overlay -->
          @if (activeSearchDropdownShow()?.id === show.id) {
            <div class="absolute inset-0 z-30 bg-slate-950/95 p-2.5 flex flex-col justify-between rounded-xl border border-white/10 animate-fade-in" (click)="$event.stopPropagation()">
              @if (searchDropdownLoading) {
                <div class="flex flex-1 items-center justify-center">
                  <svg class="animate-spin h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              } @else {
                <div class="flex-grow overflow-y-auto min-h-0 mb-1.5 pr-0.5" style="max-height: calc(100% - 64px);">
                  <div class="flex justify-between items-center mb-1">
                    <p class="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Seasons</p>
                    <button (click)="activeSearchDropdownShow.set(null); $event.stopPropagation()" class="text-zinc-500 hover:text-white p-0.5">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                  <div class="grid grid-cols-4 gap-1">
                    @for (season of searchDropdownSeasonNumbers; track season) {
                      <button
                        (click)="searchDropdownSeasonsToAdd = season; $event.stopPropagation()"
                        [class]="searchDropdownSeasonsToAdd === season ? 'bg-blue-600 text-white font-bold' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'"
                        class="h-6 text-[10px] rounded transition-all">
                        {{ season }}
                      </button>
                    }
                  </div>
                </div>
                
                <div class="flex flex-col gap-1 shrink-0 mt-1 mb-8">
                  <button
                    (click)="addSearchDropdownShow(); $event.stopPropagation()"
                    [disabled]="searchDropdownSeasonsToAdd === 0"
                    class="w-full py-1.5 bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1">
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    Mark watched
                  </button>
                  
                  @if (state.isInPending(show.id)) {
                    <button
                      (click)="state.removePending(show.id); activeSearchDropdownShow.set(null); $event.stopPropagation()"
                      class="w-full py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      Remove pending
                    </button>
                  } @else {
                    <button
                      (click)="state.addToPending(show); activeSearchDropdownShow.set(null); $event.stopPropagation()"
                      class="w-full py-1.5 bg-violet-600/30 border border-violet-500/40 text-violet-300 hover:bg-violet-600/50 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Mark pending
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
        <h3 class="text-white text-xs font-semibold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">{{ show.name }}</h3>
      </div>
    </ng-template>
  `
})
export class TopSeriesComponent implements OnInit {
  private tvmaze = inject(TvmazeService);
  state = inject(ShowStateService);

  /** Full list of top-rated shows fetched from the API. */
  topRatedShows = signal<TVShow[]>([]);
  /** Current page number in the paginated grid (1-based). */
  topRatedCurrentPage = signal<number>(1);
  /** Currently selected genre filter, or null for all genres. */
  selectedGenre = signal<string | null>(null);
  /** Currently selected decade filter, or null for all decades. */
  selectedDecade = signal<string | null>(null);
  /** Currently selected minimum rating filter, or null for all ratings. */
  selectedRatingMin = signal<number | null>(null);
  /** Which filter dropdown is currently open, or null if all closed. */
  activeFilterDropdown = signal<'genre' | 'year' | 'rating' | null>(null);

  /** The show whose quick-add season dropdown is currently open, or null. */
  activeSearchDropdownShow = signal<TVShow | null>(null);
  /** Number of seasons selected in the quick-add dropdown. */
  searchDropdownSeasonsToAdd = 0;
  /** Whether show details are being loaded for the quick-add dropdown. */
  searchDropdownLoading = false;

  /**
   * Computed list of shows after applying all active filters (genre, decade, rating).
   * Re-evaluates automatically when any filter signal changes.
   */
  filteredTopRatedShows = computed(() => {
    let shows = this.topRatedShows();
    
    const genre = this.selectedGenre();
    if (genre) {
      shows = shows.filter(s => s.genres?.includes(genre));
    }
    
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
    
    const rating = this.selectedRatingMin();
    if (rating) {
      shows = shows.filter(s => s.rating !== null && s.rating >= rating);
    }
    
    return shows;
  });

  /** Total number of pages based on filtered results (49 items per page). */
  topRatedTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredTopRatedShows().length / 49)));
  
  /** Computed slice of shows for the current page. */
  topRatedPageShows = computed(() => {
    const page = this.topRatedCurrentPage();
    const shows = this.filteredTopRatedShows();
    return shows.slice((page - 1) * 49, page * 49);
  });

  /** 1-based index of the first item on the current page. */
  topRatedRangeStart = computed(() => {
    const total = this.filteredTopRatedShows().length;
    if (total === 0) return 0;
    return (this.topRatedCurrentPage() - 1) * 49 + 1;
  });

  /** 1-based index of the last item on the current page. */
  topRatedRangeEnd = computed(() => {
    return Math.min(this.topRatedCurrentPage() * 49, this.filteredTopRatedShows().length);
  });

  /** Fetches the top-rated shows from the API on component initialization. */
  ngOnInit(): void {
    this.tvmaze.getTopRatedShows().subscribe(shows => {
      this.topRatedShows.set(shows);
      this.topRatedCurrentPage.set(1);
    });
  }

  /**
   * Applies a filter and resets pagination to page 1.
   * Closes the active filter dropdown after selection.
   * @param type - The filter category to update ('genre', 'decade', or 'rating').
   * @param value - The filter value, or null to clear the filter.
   */
  setFilter(type: 'genre' | 'decade' | 'rating', value: any): void {
    if (type === 'genre') this.selectedGenre.set(value);
    else if (type === 'decade') this.selectedDecade.set(value);
    else if (type === 'rating') this.selectedRatingMin.set(value);
    this.topRatedCurrentPage.set(1);
    this.activeFilterDropdown.set(null);
  }

  /**
   * Toggles the inline season-picker dropdown for a show card.
   * Fetches full show details (with seasons) when opening.
   * @param show - The show to toggle the dropdown for.
   * @param event - The click event (stopped from propagating to the card).
   */
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

  /**
   * Returns an array of season numbers [1..N] for the currently open dropdown show.
   * Used to render the season selection buttons.
   */
  get searchDropdownSeasonNumbers(): number[] {
    const show = this.activeSearchDropdownShow();
    if (!show?.number_of_seasons) return [];
    return Array.from({ length: show.number_of_seasons }, (_, i) => i + 1);
  }

  /**
   * Adds the show from the quick-add dropdown to the user's watchlist
   * with the selected number of seasons, then closes the dropdown.
   */
  addSearchDropdownShow(): void {
    const show = this.activeSearchDropdownShow();
    if (!show || this.searchDropdownSeasonsToAdd === 0) return;
    this.state.addWatchedShow(show, this.searchDropdownSeasonsToAdd);
    this.activeSearchDropdownShow.set(null);
    this.searchDropdownSeasonsToAdd = 0;
  }

  /**
   * Computes which page numbers to display in the pagination bar.
   * Shows first page, last page, current page ±1, and ellipsis for gaps.
   * @returns An array of page numbers, with -1 representing ellipsis.
   */
  getVisiblePages(): number[] {
    const current = this.topRatedCurrentPage();
    const total = this.topRatedTotalPages();
    
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    
    const pages: number[] = [];
    pages.push(1);
    
    if (current > 3) {
      pages.push(-1);
    }
    
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (current < total - 2) {
      pages.push(-1);
    }
    
    pages.push(total);
    return pages;
  }
}
