import { Component, signal, computed, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, tap } from 'rxjs';
import { TVShow, WatchedShow, PendingShow } from '../../models';
import { TmdbService } from '../../services/tmdb.service';
import { ShowStateService } from '../../services/show-state.service';

/**
 * Universal search component for discovering, adding, and quickly finding shows.
 * Intelligently presents shows already in the user's watchlist/pending list at the top,
 * followed by TMDB catalog results localized with both native and original titles.
 */
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [SlicePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <!-- Search Input Container (z-50 so backdrop never blocks interaction) -->
      <div class="relative group z-50">
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-white transition-colors z-20 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>

        <input
          type="text"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange($event)"
          (focus)="showDropdown.set(true)"
          (keydown.enter)="searchImmediate()"
          placeholder="Search TV show (e.g. Breaking Bad, La casa de papel, Severance)..."
          class="relative w-full glass-strong rounded-2xl py-4 pl-12 pr-12 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-white/10 transition-all z-20 shadow-xl"
        />

        <!-- Loading spinner or Clear button -->
        @if (isLoading()) {
          <div class="absolute right-4 top-1/2 -translate-y-1/2 z-20">
            <svg class="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        } @else if (searchQuery.length > 0) {
          <button 
            (click)="searchQuery = ''; onSearchChange('');" 
            class="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        }
      </div>

      <!-- Backdrop to close dropdown when clicking outside -->
      @if (showDropdown() && (hasResults() || hasEmptyState())) {
        <div class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in" (click)="closeDropdown()"></div>
      }

      <!-- Results Dropdown -->
      @if (showDropdown() && hasResults()) {
        <div class="absolute z-50 w-full mt-2 glass-strong rounded-2xl overflow-hidden animate-fade-in-scale max-h-[75vh] overflow-y-auto custom-scrollbar border border-white/15 shadow-2xl">

          <!-- 🌟 SECTION 1: Matches in user's WATCHED SHOWS -->
          @if (matchedWatchedShows().length > 0) {
            <div class="px-4 py-2 bg-emerald-950/40 border-b border-white/10 flex items-center justify-between">
              <span class="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>✅</span>
                <span>En tus series vistas ({{ matchedWatchedShows().length }})</span>
              </span>
              <span class="text-[10px] text-zinc-400">Pulsa para ver detalles</span>
            </div>

            @for (item of matchedWatchedShows(); track item.instanceId) {
              <div 
                class="border-b border-white/5 p-3 hover:bg-emerald-500/10 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                (click)="state.openDetails(item.show); closeDropdown()">
                <div class="flex items-center gap-3.5 min-w-0">
                  <img [src]="item.show.poster_path" [alt]="item.show.name" class="w-10 h-14 object-cover rounded-lg shadow-md shrink-0" />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h4 class="text-sm font-bold text-white truncate hover:text-blue-400 transition-colors">{{ item.show.name }}</h4>
                      @if (item.show.original_name && isDifferentName(item.show.name, item.show.original_name)) {
                        <span class="text-xs text-zinc-400 italic">({{ item.show.original_name }})</span>
                      }
                      <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black">
                        {{ item.seasonsWatched }}/{{ item.show.number_of_seasons }} temporadas
                      </span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                      <span>{{ item.show.first_air_date | slice:0:4 }}</span>
                      <span>•</span>
                      <span>{{ item.episodesWatched }} eps vistos</span>
                      @if (item.userRating > 0) {
                        <span>•</span>
                        <span class="text-amber-400 font-bold">★ {{ item.userRating }}/10</span>
                      }
                    </div>
                  </div>
                </div>
                <span class="text-xs text-blue-400 font-bold shrink-0">Ver ficha →</span>
              </div>
            }
          }

          <!-- ⏳ SECTION 2: Matches in user's PENDING SHOWS -->
          @if (matchedPendingShows().length > 0) {
            <div class="px-4 py-2 bg-violet-950/40 border-b border-white/10 flex items-center justify-between">
              <span class="text-[11px] font-black uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                <span>⏳</span>
                <span>En tus series pendientes ({{ matchedPendingShows().length }})</span>
              </span>
              <span class="text-[10px] text-zinc-400">Pulsa para ver o empezar a ver</span>
            </div>

            @for (pending of matchedPendingShows(); track pending.show.id) {
              <div 
                class="border-b border-white/5 p-3 hover:bg-violet-500/10 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                (click)="state.openDetails(pending.show); closeDropdown()">
                <div class="flex items-center gap-3.5 min-w-0">
                  <img [src]="pending.show.poster_path" [alt]="pending.show.name" class="w-10 h-14 object-cover rounded-lg shadow-md shrink-0" />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h4 class="text-sm font-bold text-white truncate hover:text-blue-400 transition-colors">{{ pending.show.name }}</h4>
                      @if (pending.show.original_name && isDifferentName(pending.show.name, pending.show.original_name)) {
                        <span class="text-xs text-zinc-400 italic">({{ pending.show.original_name }})</span>
                      }
                      <span class="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] font-black">
                        Pendiente
                      </span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                      <span>{{ pending.show.first_air_date | slice:0:4 }}</span>
                      @if (pending.show.rating) {
                        <span>•</span>
                        <span class="text-amber-400 font-bold">★ {{ pending.show.rating }}</span>
                      }
                    </div>
                  </div>
                </div>
                <span class="text-xs text-blue-400 font-bold shrink-0">Ver ficha →</span>
              </div>
            }
          }

          <!-- 🌐 SECTION 3: TMDB Search Results -->
          @if (searchResults().length > 0) {
            @if (matchedWatchedShows().length > 0 || matchedPendingShows().length > 0) {
              <div class="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <span class="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <span>🌐</span>
                  <span>Catálogo de series (TMDB)</span>
                </span>
                <span class="text-[10px] text-zinc-500">{{ searchResults().length }} resultados</span>
              </div>
            }

            @for (show of searchResults(); track show.id) {
              <div class="border-b border-white/5 last:border-0 relative z-50 hover:bg-white/5 transition-colors">
                <!-- Main row: Clicking opens full details modal -->
                <div class="flex items-center gap-4 p-3 cursor-pointer"
                     (click)="state.openDetails(show); closeDropdown()">
                  
                  <div class="relative shrink-0">
                    <img [src]="show.poster_path" [alt]="show.name" class="w-10 h-14 object-cover rounded-lg shadow-md" />
                    @if (state.isWatched(show.id)) {
                      <div class="absolute -top-1 -left-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white border border-emerald-400/30 shadow-md" title="En tus series vistas">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                    } @else if (state.isInPending(show.id)) {
                      <div class="absolute -top-1 -left-1 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center text-white border border-violet-500/30 shadow-md" title="En tus series pendientes">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-white truncate">
                      {{ show.name }}
                      @if (show.localized_name && isDifferentName(show.name, show.localized_name)) {
                        <span class="text-xs text-zinc-400 font-normal italic ml-1">({{ show.localized_name }})</span>
                      } @else if (show.original_name && isDifferentName(show.name, show.original_name)) {
                        <span class="text-xs text-zinc-400 font-normal italic ml-1">({{ show.original_name }})</span>
                      }
                      @if (show.first_air_date) {
                        <span class="text-zinc-500 font-normal ml-1">({{ show.first_air_date | slice:0:4 }})</span>
                      }
                    </h3>
                    
                    <div class="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span>{{ show.first_air_date | slice:0:4 }}</span>
                      @if (show.number_of_seasons) {
                        <span>• {{ show.number_of_seasons }} temporada{{ show.number_of_seasons !== 1 ? 's' : '' }}</span>
                      }
                      @if (show.rating !== null) {
                        <span class="flex items-center gap-0.5 font-semibold text-amber-400">
                          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                          {{ show.rating }}
                        </span>
                      }
                    </div>
                  </div>

                  <!-- Quick-add Season Chevron button -->
                  <button
                    (click)="toggleSearchDropdown(show, $event)"
                    [class]="'p-2 rounded-lg transition-all shrink-0 ' + (activeSearchDropdownShow()?.id === show.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/10')"
                    title="Añadir temporadas rápidamente">
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
                      <p class="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-2">Temporadas vistas</p>
                      
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
                              ? 'bg-white text-black font-bold shadow-md' 
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
                          class="w-full py-2 px-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                          Marcar como vista
                        </button>
                        
                        @if (state.isInPending(show.id)) {
                          <button
                            (click)="state.removePending(show.id); activeSearchDropdownShow.set(null); closeDropdown(); $event.stopPropagation()"
                            class="w-full py-2 px-3 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            Quitar de pendientes
                          </button>
                        } @else {
                          <button
                            (click)="state.addToPending(show); activeSearchDropdownShow.set(null); closeDropdown(); $event.stopPropagation()"
                            class="w-full py-2 px-3 bg-violet-600/30 border border-violet-500/40 text-violet-300 hover:bg-violet-600/50 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Añadir a pendientes
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          }

        </div>
      }

      <!-- Empty state when no matches found -->
      @if (showDropdown() && hasEmptyState()) {
        <div class="absolute z-50 w-full mt-2 glass-strong rounded-2xl p-6 text-center border border-white/15 shadow-2xl animate-fade-in">
          <div class="w-12 h-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <p class="text-sm font-bold text-white">No se encontraron series para "{{ searchQuery }}"</p>
          <p class="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">Comprueba la ortografía o intenta buscar por su título original en inglés u otro idioma.</p>
        </div>
      }

    </div>
  `
})
export class SearchComponent implements OnInit, OnDestroy {
  private tmdb = inject(TmdbService);
  private cdr = inject(ChangeDetectorRef);
  state = inject(ShowStateService);

  searchQuery = '';
  searchQuerySignal = signal<string>('');
  searchResults = signal<TVShow[]>([]);
  showDropdown = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  activeSearchDropdownShow = signal<TVShow | null>(null);
  searchDropdownLoading = false;
  searchDropdownSeasonsToAdd = 0;
  searchDropdownSeasonNumbers: number[] = [];
  dropdownSeasonWarning: string | null = null;

  private searchSubject = new Subject<string>();
  private subscription: any;

  private cleanText(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  isDifferentName(name: string, orig: string): boolean {
    return this.cleanText(name) !== this.cleanText(orig);
  }

  private matchesQuery(show: TVShow, q: string): boolean {
    return this.cleanText(show.name).includes(q) || 
           this.cleanText(show.original_name || '').includes(q) || 
           this.cleanText(show.localized_name || '').includes(q);
  }

  matchedWatchedShows = computed(() => {
    const q = this.cleanText(this.searchQuerySignal());
    return q.length >= 2 ? this.state.watchedShows().filter(i => this.matchesQuery(i.show, q)) : [];
  });

  matchedPendingShows = computed(() => {
    const q = this.cleanText(this.searchQuerySignal());
    return q.length >= 2 ? this.state.pendingShows().filter(i => this.matchesQuery(i.show, q)) : [];
  });

  hasResults = computed(() => {
    return this.searchResults().length > 0 || 
           this.matchedWatchedShows().length > 0 || 
           this.matchedPendingShows().length > 0;
  });

  hasEmptyState = computed(() => {
    return !this.isLoading() && 
           this.searchQuerySignal().trim().length >= 2 && 
           !this.hasResults();
  });

  private searchCache = new Map<string, TVShow[]>();

  ngOnInit() {
    this.subscription = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(query => {
        const trimmed = query.trim();
        if (!trimmed) {
          this.isLoading.set(false);
          this.searchResults.set([]);
          this.cdr.markForCheck();
          return of([]);
        }
        const key = trimmed.toLowerCase();
        if (this.searchCache.has(key)) {
          this.isLoading.set(false);
          this.cdr.markForCheck();
          return of(this.searchCache.get(key)!);
        }
        this.isLoading.set(true);
        this.cdr.markForCheck();
        return this.tmdb.searchShows(trimmed).pipe(
          tap(results => this.searchCache.set(key, results))
        );
      })
    ).subscribe(results => {
      this.searchResults.set(results);
      this.isLoading.set(false);
      this.showDropdown.set(true);
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onSearchChange(query: string) {
    this.searchQuery = query;
    this.searchQuerySignal.set(query);
    if (!query.trim()) {
      this.searchResults.set([]);
      this.showDropdown.set(false);
      this.isLoading.set(false);
      this.cdr.markForCheck();
    } else {
      this.showDropdown.set(true);
      this.searchSubject.next(query);
    }
  }

  searchImmediate() {
    const trimmed = this.searchQuery.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (this.searchCache.has(key)) {
      this.searchResults.set(this.searchCache.get(key)!);
      this.isLoading.set(false);
      this.showDropdown.set(true);
      this.cdr.markForCheck();
      return;
    }
    this.isLoading.set(true);
    this.cdr.markForCheck();
    this.tmdb.searchShows(trimmed).subscribe(results => {
      this.searchCache.set(key, results);
      this.searchResults.set(results);
      this.isLoading.set(false);
      this.showDropdown.set(true);
      this.cdr.markForCheck();
    });
  }

  closeDropdown() {
    this.showDropdown.set(false);
    this.activeSearchDropdownShow.set(null);
    this.cdr.markForCheck();
  }

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

  isDropdownSeasonAired(seasonNumber: number): boolean {
    const show = this.activeSearchDropdownShow();
    if (!show || !show.seasons || show.seasons.length === 0) return true;
    const s = show.seasons.find(season => season.season_number === seasonNumber);
    return s ? s.is_aired !== false : true;
  }

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

  addSearchDropdownShow() {
    const show = this.activeSearchDropdownShow();
    if (show && this.searchDropdownSeasonsToAdd > 0) {
      this.state.addWatchedShow(show, this.searchDropdownSeasonsToAdd);
      this.activeSearchDropdownShow.set(null);
      this.closeDropdown();
      this.searchQuery = '';
      this.searchQuerySignal.set('');
    }
  }
}
