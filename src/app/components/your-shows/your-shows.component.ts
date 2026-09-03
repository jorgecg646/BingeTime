import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WatchedShow, TVShow, ALL_GENRES, formatGenresLabel } from '../../models';
import { ShowStateService } from '../../services/show-state.service';

/**
 * Displays the user's watched shows in a responsive poster grid.
 * Features customizable sorting (recently added, highest rated, most time, release year, A-Z)
 * and multi-select genre filtering identical to Discover.
 * Each poster reveals an interactive overlay on hover with show details,
 * season controls, rating selector, and delete option.
 */
@Component({
  selector: 'app-your-shows',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (watchedShows().length > 0) {
      <div class="space-y-4">
        
        <!-- Controls Bar: Title + Counter + Sort + Genre Filter -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-white/5 pb-3">
          <div class="flex items-center gap-3">
            <h2 class="text-2xl font-bold tracking-tight text-white">Your Shows</h2>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-semibold">
              {{ sortedWatchedShows().length }}
              @if (sortedWatchedShows().length !== watchedShows().length) {
                <span> of {{ watchedShows().length }}</span>
              }
            </span>
          </div>

          <!-- Sort and Genre Filter Controls -->
          <div class="flex flex-wrap items-center gap-2 relative">
            @if (activeDropdown()) {
              <!-- Backdrop dismisser -->
              <div class="fixed inset-0 z-40 bg-transparent" (click)="activeDropdown.set(null)"></div>
            }

            <!-- Sort By Selector -->
            <div class="relative">
              <button 
                (click)="activeDropdown.set(activeDropdown() === 'sort' ? null : 'sort')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs shadow-sm">
                <span>SORT: {{ getSortLabel() }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'sort'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeDropdown() === 'sort') {
                <div class="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 z-50 w-52 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-1.5 animate-fade-in">
                  @for (opt of sortOptions; track opt.value) {
                    <button (click)="setSort(opt.value)" class="w-full text-left px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-between" [class.text-blue-400]="selectedSort() === opt.value">
                      <span>{{ opt.label }}</span>
                      @if (selectedSort() === opt.value) {
                        <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                      }
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Genre Filter (Multi-select, identical to discover) -->
            <div class="relative">
              <button 
                (click)="activeDropdown.set(activeDropdown() === 'genre' ? null : 'genre')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs shadow-sm"
                [class.border-blue-500]="selectedGenres().length > 0"
                [class.text-blue-400]="selectedGenres().length > 0">
                <span>GENRES: {{ getGenreLabel() }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'genre'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeDropdown() === 'genre') {
                <div class="absolute top-full right-0 mt-2 z-50 w-64 max-w-[calc(100vw-2.5rem)] bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-2.5 max-h-80 flex flex-col animate-fade-in">
                  <div class="flex items-center justify-between pb-2 mb-1.5 border-b border-white/10 px-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Select Genres</span>
                    @if (selectedGenres().length > 0) {
                      <button (click)="clearGenres()" class="text-[10px] text-red-400 hover:text-red-300 font-bold px-1.5 py-0.5 rounded bg-red-500/10">Reset</button>
                    }
                  </div>
                  <div class="overflow-y-auto space-y-0.5 custom-scrollbar pr-1 flex-1">
                    @for (genre of genres; track genre) {
                      <label class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs transition-colors">
                        <input 
                          type="checkbox" 
                          [checked]="isGenreSelected(genre)"
                          (change)="toggleGenre(genre)"
                          class="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <span [class.text-white]="isGenreSelected(genre)" [class.text-zinc-400]="!isGenreSelected(genre)">{{ genre }}</span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Clear button when active filters exist -->
            @if (selectedGenres().length > 0 || selectedSort() !== 'recently_added') {
              <button 
                (click)="clearGenres(); selectedSort.set('recently_added')"
                class="px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all"
                title="Reset all filters">
                Clear
              </button>
            }
          </div>
        </div>

        <!-- Empty state when genre filter leaves 0 results -->
        @if (sortedWatchedShows().length === 0) {
          <div class="py-12 px-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center animate-fade-in">
            <p class="text-sm font-semibold text-zinc-300">No series match your selected genre filter</p>
            <button (click)="clearGenres()" class="mt-3 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all">
              Show all {{ watchedShows().length }} series
            </button>
          </div>
        } @else {
          <div class="relative transition-all duration-500 ease-in-out"
               [class]="showCollapseControls() && !isExpanded() ? 'max-h-[220px] sm:max-h-[280px] md:max-h-[380px] overflow-hidden' : ''">
            
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-0 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
              @for (item of sortedWatchedShows(); track item.instanceId; let i = $index) {
                <div class="relative aspect-[2/3] overflow-hidden group animate-slide-up cursor-pointer" 
                     (click)="openDetails.emit(item.show)"
                     [style.animation-delay]="i * 50 + 'ms'">
                  <!-- Poster Image -->
                  <img [src]="item.show.poster_path" [alt]="item.show.name" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  
                  <!-- New episode notification badge -->
                  @if (state.hasNewEpisodeAlert(item.show.id)) {
                    <div class="absolute top-2 left-2 z-20 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-black text-[9px] font-black animate-pulse shadow-lg border-2 border-amber-400" title="New episodes available!">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                    </div>
                  }
                  
                  <!-- Golden Circular Delete Button (Always visible) -->
                  <button (click)="removeShow.emit(item.instanceId); $event.stopPropagation()" 
                          class="absolute top-2 right-2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full border-4 border-amber-500 bg-black/60 text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center active:scale-95 shadow-lg" 
                          title="Delete show">
                    <svg class="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                  
                  <!-- Default Bottom Info Overlay -->
                  <div class="absolute bottom-0 inset-x-0 p-2 sm:p-3 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none flex items-end justify-between gap-2 z-10">
                    <h4 class="text-white text-xs sm:text-lg font-bold leading-tight line-clamp-1 drop-shadow-md">{{ item.show.name }}</h4>
                    <span class="text-white text-sm sm:text-xl font-black shrink-0 drop-shadow-md">{{ item.seasonsWatched }}</span>
                  </div>
                  
                  <!-- Glassmorphic Hover Overlay -->
                  <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/85 backdrop-blur-md flex flex-col justify-between p-2 sm:p-5 select-none cursor-pointer z-10"
                       (click)="openDetails.emit(item.show)">
                    
                    <!-- Top: Seasons and Time -->
                    <div class="space-y-1 sm:space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-[9px] sm:text-xs text-zinc-400 font-bold uppercase tracking-wider">Seasons</span>
                        <div class="flex items-center gap-1 sm:gap-2">
                          <button (click)="changeSeason.emit({ item, delta: -1 }); $event.stopPropagation()" 
                                  [disabled]="item.seasonsWatched <= 1"
                                  class="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-bold active:scale-95" 
                                  title="Remove season">
                            -
                          </button>
                          <span class="text-white font-black text-xs sm:text-base px-1">{{ item.seasonsWatched }}</span>
                          <button (click)="changeSeason.emit({ item, delta: 1 }); $event.stopPropagation()" 
                                  [disabled]="item.seasonsWatched >= state.getMaxAiredSeasons(item.show)"
                                  class="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-bold active:scale-95" 
                                  title="Add season">
                            +
                          </button>
                        </div>
                      </div>
                      <div class="text-[8px] sm:text-[10px] text-zinc-500 font-semibold uppercase tracking-wider text-right">
                        max: {{ state.getMaxAiredSeasons(item.show) }}
                      </div>
                    </div>

                    <!-- Center: Watch Time -->
                    <div class="text-center py-0.5 sm:py-2">
                      <div class="text-[9px] sm:text-xs text-zinc-400 font-medium">Watched Time</div>
                      <span class="font-black text-white text-xs sm:text-base md:text-lg">{{ formatTime(item.totalMinutes) }}</span>
                    </div>
                    
                    <!-- Bottom: User Rating Select & Episode Count -->
                    <div class="space-y-1 sm:space-y-2 pt-1.5 sm:pt-2 border-t border-white/5">
                      <div class="flex items-center justify-between gap-1">
                        <span class="text-[9px] sm:text-xs text-zinc-300 font-medium">Rating:</span>
                        <select [ngModel]="item.userRating" (ngModelChange)="setUserRating.emit({ item, rating: +$event }); $event.stopPropagation()" 
                                (click)="$event.stopPropagation()"
                                class="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-[9px] sm:text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer">
                          <option [ngValue]="0" class="bg-zinc-900">--</option>
                          @for (n of ratingOptions; track n) {
                            <option [ngValue]="n" class="bg-zinc-900">{{ n }}</option>
                          }
                        </select>
                      </div>
                      <div class="text-[8px] sm:text-[10px] text-zinc-500 text-center font-medium">{{ item.episodesWatched }} eps watched</div>
                    </div>

                  </div>
                </div>
              }
            </div>

            <!-- Blur/Fade overlay when minimized -->
            @if (showCollapseControls() && !isExpanded()) {
              <div class="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent pointer-events-none z-10 backdrop-blur-[1.5px]"></div>
            }
          </div>

          <!-- Toggle Button -->
          @if (showCollapseControls()) {
            <div class="flex justify-center pt-2">
              <button (click)="isExpanded.set(!isExpanded())" 
                      class="px-6 py-2 rounded-full glass border border-white/10 text-white font-semibold hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 shadow-lg backdrop-blur-md">
                <span>{{ isExpanded() ? 'Show less' : 'Show all' }}</span>
                <svg class="w-4 h-4 transition-transform duration-300" [class.rotate-180]="isExpanded()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
            </div>
          }
        }

      </div>
    }
  `
})
export class YourShowsComponent {
  state = inject(ShowStateService);

  watchedShows = input.required<WatchedShow[]>();

  openDetails = output<TVShow>();
  changeSeason = output<{ item: WatchedShow; delta: number }>();
  removeShow = output<string>();
  setUserRating = output<{ item: WatchedShow; rating: number }>();

  /** Controls whether all shows or only the top rows are rendered in the grid. */
  isExpanded = signal<boolean>(false);
  showCollapseControls = computed(() => this.watchedShows().length > 6);

  ratingOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  readonly genres = ALL_GENRES;
  selectedGenres = signal<string[]>([]);
  selectedSort = signal<string>('recently_added');
  activeDropdown = signal<'sort' | 'genre' | null>(null);

  sortOptions = [
    { value: 'recently_added', label: 'Recently Added' },
    { value: 'rating_desc', label: 'Highest Rating' },
    { value: 'hours_desc', label: 'Most Time Watched' },
    { value: 'year_desc', label: 'Release Year (Newest)' },
    { value: 'year_asc', label: 'Release Year (Oldest)' },
    { value: 'alpha_asc', label: 'Alphabetical (A-Z)' },
  ];

  getSortLabel(): string {
    const opt = this.sortOptions.find(o => o.value === this.selectedSort());
    return opt ? opt.label : 'Recently Added';
  }

  getGenreLabel(): string {
    return formatGenresLabel(this.selectedGenres());
  }

  isGenreSelected(genre: string): boolean {
    return this.selectedGenres().includes(genre);
  }

  toggleGenre(genre: string): void {
    const current = this.selectedGenres();
    if (current.includes(genre)) {
      this.selectedGenres.set(current.filter(g => g !== genre));
    } else {
      this.selectedGenres.set([...current, genre]);
    }
  }

  clearGenres(): void {
    this.selectedGenres.set([]);
  }

  setSort(value: string): void {
    this.selectedSort.set(value);
    this.activeDropdown.set(null);
  }

  sortedWatchedShows = computed(() => {
    const raw = this.watchedShows();
    if (!raw || raw.length === 0) return [];

    let list = [...raw];

    // 1. Filter by selected genres
    const selGenres = this.selectedGenres();
    if (selGenres.length > 0) {
      list = list.filter(w => {
        const showGenres = w.show.genres || [];
        return selGenres.some(sg => showGenres.includes(sg));
      });
    }

    // 2. Sort
    const sort = this.selectedSort();
    if (sort === 'rating_desc') return list.sort((a, b) => ((b.userRating || 0) - (a.userRating || 0)) || ((b.show.rating || 0) - (a.show.rating || 0)));
    if (sort === 'hours_desc') return list.sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0));
    if (sort === 'year_desc') return list.sort((a, b) => (parseInt(b.show.first_air_date || '0') || 0) - (parseInt(a.show.first_air_date || '0') || 0));
    if (sort === 'year_asc') return list.sort((a, b) => (parseInt(a.show.first_air_date || '9999') || 9999) - (parseInt(b.show.first_air_date || '9999') || 9999));
    if (sort === 'alpha_asc') return list.sort((a, b) => a.show.name.localeCompare(b.show.name));
    return this.state.sortByAddedAt(list);
  });

  formatTime(minutes: number): string {
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
}
