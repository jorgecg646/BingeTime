import { Component, signal, inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TVShow } from '../../models';
import { TmdbService } from '../../services/tmdb.service';
import { ShowStateService } from '../../services/show-state.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [SlicePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <div class="relative group">
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-white transition-colors z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange($event)"
          (focus)="showDropdown = true"
          placeholder="Search show..."
          class="relative w-full glass rounded-xl py-4 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all z-10"
        />
        @if (isLoading) {
          <div class="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        } @else if (searchQuery.length > 0) {
          <button (click)="searchQuery = ''; onSearchChange('');" class="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-zinc-400 hover:text-white transition-colors p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        }
      </div>

      @if (showDropdown && searchResults.length > 0) {
        <!-- Backdrop to close dropdown when clicking outside -->
        <div class="fixed inset-0 z-40" (click)="closeDropdown()"></div>
        
        <div class="absolute z-50 w-full mt-2 glass-strong rounded-xl overflow-hidden animate-fade-in-scale max-h-[70vh] overflow-y-auto custom-scrollbar border border-white/10 shadow-2xl">
          @for (show of searchResults; track show.id) {
            <div class="border-b border-white/5 last:border-0 relative z-50 hover:bg-white/5 transition-colors">
              <!-- Main row: Clicking opens full details modal -->
              <div class="flex items-center gap-4 p-3 cursor-pointer"
                   (click)="state.openDetails(show); closeDropdown()">
                <div class="relative shrink-0">
                  <img [src]="show.poster_path" [alt]="show.name" class="w-10 h-14 object-cover rounded-lg shadow-md" />
                  @if (state.isWatched(show.id)) {
                    <div class="absolute -top-1 -left-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white border border-emerald-400/30 shadow-md" title="Watched">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                  } @else if (state.isInPending(show.id)) {
                    <div class="absolute -top-1 -left-1 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center text-white border border-violet-500/30 shadow-md" title="Pending">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-white truncate">{{ show.name }}@if (show.first_air_date) { <span class="text-zinc-500 font-normal">({{ show.first_air_date | slice:0:4 }})</span>}</h3>
                  <div class="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{{ show.first_air_date | slice:0:4 }}</span>
                    @if (show.number_of_seasons) {
                      <span>• {{ show.number_of_seasons }} season{{ show.number_of_seasons !== 1 ? 's' : '' }}</span>
                    }
                    @if (show.rating !== null) {
                      <span class="flex items-center gap-0.5 font-semibold text-amber-400">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                        {{ show.rating }}
                      </span>
                    }
                  </div>
                </div>
                <!-- Chevron button -->
                <button
                  (click)="toggleSearchDropdown(show, $event)"
                  [class]="'p-2 rounded-lg transition-all shrink-0 ' + (activeSearchDropdownShow()?.id === show.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/10')"
                  title="Quick add">
                  <svg class="w-4 h-4 transition-transform duration-200"
                       [class.rotate-180]="activeSearchDropdownShow()?.id === show.id"
                       fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
              </div>

              <!-- Inline season dropdown -->
              @if (activeSearchDropdownShow()?.id === show.id) {
                <div class="px-3 pb-3 pt-2 bg-white/5 border-t border-white/10 animate-fade-in relative z-50">
                  @if (searchDropdownLoading) {
                    <div class="flex justify-center py-3">
                      <svg class="animate-spin h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  } @else {
                    <p class="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-2">Seasons watched</p>
                    
                    @if (dropdownSeasonWarning) {
                      <div class="mb-2.5 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs leading-snug">
                        {{ dropdownSeasonWarning }}
                      </div>
                    }

                    <div class="flex flex-wrap gap-1.5 mb-3">
                      @for (season of searchDropdownSeasonNumbers; track season) {
                        <button
                          (click)="selectDropdownSeason(season); $event.stopPropagation()"
                          [class]="searchDropdownSeasonsToAdd === season 
                            ? 'bg-white text-black font-bold' 
                            : (isDropdownSeasonAired(season) ? 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white' : 'bg-white/5 text-amber-400/60 hover:bg-white/10 border border-dashed border-amber-500/30')"
                          class="w-9 h-9 rounded-lg text-sm font-semibold transition-all relative">
                          {{ season }}
                          @if (!isDropdownSeasonAired(season)) {
                            <span class="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                          }
                        </button>
                      }
                    </div>
                    <div class="flex flex-col gap-1.5 mt-2">
                      <button
                        (click)="addSearchDropdownShow(); $event.stopPropagation()"
                        [disabled]="searchDropdownSeasonsToAdd === 0"
                        class="w-full py-2 px-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                        Mark as watched
                      </button>
                      
                      @if (state.isInPending(show.id)) {
                        <button
                          (click)="state.removePending(show.id); activeSearchDropdownShow.set(null); closeDropdown(); $event.stopPropagation()"
                          class="w-full py-2 px-3 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          Remove from pending
                        </button>
                      } @else {
                        <button
                          (click)="state.addToPending(show); activeSearchDropdownShow.set(null); closeDropdown(); $event.stopPropagation()"
                          class="w-full py-2 px-3 bg-violet-600/30 border border-violet-500/40 text-violet-300 hover:bg-violet-600/50 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Add to pending
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SearchComponent implements OnInit, OnDestroy {
  private tmdb = inject(TmdbService);
  state = inject(ShowStateService);

  /** Current text in the search input field. */
  searchQuery = '';
  /** Array of shows matching the current search query. */
  searchResults: TVShow[] = [];
  /** Whether the search results dropdown is visible. */
  showDropdown = false;
  /** Whether a search API request is in-flight. */
  isLoading = false;

  /** The show currently expanded in the inline season-picker dropdown. */
  activeSearchDropdownShow = signal<TVShow | null>(null);
  /** Whether full details (seasons) are loading for the expanded search dropdown show. */
  searchDropdownLoading = false;
  /** Number of seasons selected to add in the inline dropdown. */
  searchDropdownSeasonsToAdd = 0;
  /** Array of season numbers [1..N] for the expanded search dropdown show. */
  searchDropdownSeasonNumbers: number[] = [];
  /** Warning message if a selected season has not yet aired. */
  dropdownSeasonWarning: string | null = null;

  /** RxJS Subject that debounces user input to prevent excessive API calls. */
  private searchSubject = new Subject<string>();
  private subscription: any;

  ngOnInit() {
    this.subscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim()) {
          this.isLoading = false;
          return of([]);
        }
        this.isLoading = true;
        return this.tmdb.searchShows(query);
      })
    ).subscribe(results => {
      this.searchResults = results;
      this.isLoading = false;
      this.showDropdown = true;
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /** Pushes a new query string to the debounced search subject. */
  onSearchChange(query: string) {
    this.searchSubject.next(query);
  }

  /** Closes the search dropdown and collapses any expanded inline season picker. */
  closeDropdown() {
    this.showDropdown = false;
    this.activeSearchDropdownShow.set(null);
  }

  /**
   * Toggles the inline season-picker dropdown for a specific search result show.
   * If opening, fetches full show details to get accurate season counts and air dates.
   * @param show - The show to expand or collapse.
   * @param event - DOM MouseEvent (stopped to prevent row selection).
   */
  toggleSearchDropdown(show: TVShow, event: MouseEvent) {
    event.stopPropagation();
    
    if (this.activeSearchDropdownShow()?.id === show.id) {
      this.activeSearchDropdownShow.set(null);
      return;
    }

    this.activeSearchDropdownShow.set(show);
    this.searchDropdownLoading = true;
    this.searchDropdownSeasonsToAdd = 0;
    this.dropdownSeasonWarning = null;

    this.tmdb.getShowDetails(show.id).subscribe(detailedShow => {
      this.searchDropdownLoading = false;
      if (detailedShow) {
        this.activeSearchDropdownShow.set(detailedShow);
        const count = detailedShow.number_of_seasons || 1;
        this.searchDropdownSeasonNumbers = Array.from({ length: count }, (_, i) => i + 1);
      }
    });
  }

  /** Checks if a season in the inline dropdown has already aired. */
  isDropdownSeasonAired(seasonNumber: number): boolean {
    const show = this.activeSearchDropdownShow();
    if (!show || !show.seasons || show.seasons.length === 0) return true;
    const s = show.seasons.find(season => season.season_number === seasonNumber);
    return s ? s.is_aired !== false : true;
  }

  /**
   * Selects a season in the inline dropdown or sets a warning
   * if that season has not aired yet.
   * @param seasonNumber - The season number to select.
   */
  selectDropdownSeason(seasonNumber: number) {
    const show = this.activeSearchDropdownShow();
    if (!show) return;

    const seasonObj = show.seasons?.find(s => s.season_number === seasonNumber);
    if (seasonObj && seasonObj.is_aired === false) {
      this.searchDropdownSeasonsToAdd = seasonNumber;
      this.dropdownSeasonWarning = `Season ${seasonNumber} has not aired yet (air date: ${seasonObj.air_date || 'TBA'}). We'll notify you when it's released.`;
      return;
    }

    this.dropdownSeasonWarning = null;
    this.searchDropdownSeasonsToAdd = seasonNumber;
  }

  /**
   * Confirms adding the show with the selected number of seasons from the inline dropdown,
   * adds it to the user's watchlist, and closes the search dropdown.
   */
  addSearchDropdownShow() {
    const show = this.activeSearchDropdownShow();
    if (show && this.searchDropdownSeasonsToAdd > 0) {
      this.state.addWatchedShow(show, this.searchDropdownSeasonsToAdd);
      this.activeSearchDropdownShow.set(null);
      this.closeDropdown();
      this.searchQuery = '';
    }
  }
}
