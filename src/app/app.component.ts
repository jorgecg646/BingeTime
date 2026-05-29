import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TVShow, WatchedShow } from './models';
import { TvmazeService } from './services/tvmaze.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex flex-col relative overflow-hidden">
      <!-- Aurora + grid background -->
      <div class="fixed inset-0 pointer-events-none">
        <div class="aurora-blob absolute -top-32 left-1/4 w-[40rem] h-[40rem] bg-indigo-500/10 rounded-full blur-[120px]"></div>
        <div class="aurora-blob absolute top-1/3 -right-32 w-[36rem] h-[36rem] bg-teal-500/10 rounded-full blur-[120px]" style="animation-delay: -6s;"></div>
        <div class="aurora-blob absolute bottom-0 left-1/3 w-[32rem] h-[32rem] bg-sky-500/[0.07] rounded-full blur-[120px]" style="animation-delay: -12s;"></div>
        <div class="absolute inset-0" style="background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 60px 60px;"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"></div>
      </div>

      <!-- Header -->
      <header class="pt-20 pb-10 text-center relative">
        <div class="relative animate-fade-in">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 text-sm text-zinc-300">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            TV-Show time calculator
          </div>
          <h1 class="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-6 text-balance">
            <span class="gradient-text">BingeTime</span>
          </h1>
          <p class="text-zinc-400 text-lg md:text-xl max-w-lg mx-auto px-4 leading-relaxed text-pretty">
            Discover how much time you have spent watching your favorite shows
          </p>
        </div>
      </header>

      <main class="flex-1 container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <!-- Time display -->
        <div class="glass-strong rounded-3xl p-8 md:p-12 mb-10 animate-fade-in">
          <div class="flex items-stretch justify-center gap-2 md:gap-6">
            <div class="flex-1 text-center group">
              <div class="relative flex items-center justify-center rounded-2xl py-4 transition-colors group-hover:bg-white/[0.03]">
                <div class="text-5xl md:text-8xl font-bold tracking-tighter text-white tabular-nums animate-count">{{ days() }}</div>
              </div>
              <div class="text-zinc-500 text-xs md:text-sm uppercase tracking-[0.2em] mt-2 font-medium">Days</div>
            </div>
            <div class="flex items-center pb-7 text-4xl md:text-6xl font-light text-zinc-700">:</div>
            <div class="flex-1 text-center group">
              <div class="relative flex items-center justify-center rounded-2xl py-4 transition-colors group-hover:bg-white/[0.03]">
                <div class="text-5xl md:text-8xl font-bold tracking-tighter text-white tabular-nums animate-count">{{ hours() }}</div>
              </div>
              <div class="text-zinc-500 text-xs md:text-sm uppercase tracking-[0.2em] mt-2 font-medium">Hours</div>
            </div>
            <div class="flex items-center pb-7 text-4xl md:text-6xl font-light text-zinc-700">:</div>
            <div class="flex-1 text-center group">
              <div class="relative flex items-center justify-center rounded-2xl py-4 transition-colors group-hover:bg-white/[0.03]">
                <div class="text-5xl md:text-8xl font-bold tracking-tighter text-white tabular-nums animate-count">{{ minutes() }}</div>
              </div>
              <div class="text-zinc-500 text-xs md:text-sm uppercase tracking-[0.2em] mt-2 font-medium">Minutes</div>
            </div>
          </div>
          @if (totalEpisodes() > 0) {
            <div class="mt-8 pt-8 border-t border-white/5 flex items-center justify-center gap-8 text-sm">
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span class="text-zinc-400"><span class="text-white font-semibold tabular-nums">{{ totalEpisodes() }}</span> episodes</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span class="text-zinc-400"><span class="text-white font-semibold tabular-nums">{{ watchedShows().length }}</span> shows</span>
              </div>
            </div>
          }
        </div>

        <!-- Search -->
        <div class="relative mb-10">
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
            }
          </div>
          @if (showDropdown && searchResults.length > 0) {
            <div class="absolute z-50 w-full mt-2 glass-strong rounded-xl overflow-hidden animate-fade-in-scale">
              @for (show of searchResults; track show.id) {
                <button (click)="selectShow(show)" class="w-full flex items-center gap-4 p-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0">
                  <img [src]="imageUrl(show.poster_path)" [alt]="show.name" class="w-10 h-14 object-cover rounded-lg" />
                  <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-white truncate">{{ show.name }}</h3>
                    <div class="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{{ show.first_air_date | slice:0:4 }}</span>
                      @if (show.rating !== null) {
                        <span class="flex items-center gap-0.5 font-semibold text-amber-400">
                          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                          {{ show.rating }}
                        </span>
                      }
                    </div>
                  </div>
                  <svg class="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              }
            </div>
          }
        </div>

        <!-- Show list -->
        @if (watchedShows().length > 0) {
          <div class="space-y-3">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider">Your shows</h2>
              <span class="text-xs text-zinc-600">{{ watchedShows().length }} shows</span>
            </div>
            @for (item of watchedShows(); track item.show.id; let i = $index) {
              <div class="glass rounded-xl p-4 flex items-center gap-4 animate-slide-up hover-lift group" [style.animation-delay]="i * 50 + 'ms'">
                <img [src]="imageUrl(item.show.poster_path)" [alt]="item.show.name" class="w-12 h-16 object-cover rounded-lg" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="font-medium text-white truncate">{{ item.show.name }}</h3>
                    @if (item.show.rating !== null) {
                      <span class="flex items-center gap-1 shrink-0 text-xs font-semibold text-amber-400">
                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                        {{ item.show.rating }}/10
                      </span>
                    }
                  </div>
                  <div class="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                    <span>{{ item.seasonsWatched }}/{{ item.show.number_of_seasons }} seasons</span>
                    <span class="w-1.5 h-1.5 rounded-full bg-zinc-700"></span>
                    <span>{{ item.episodesWatched }} eps</span>
                  </div>
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-xs text-zinc-500">Your rating:</span>
                    <select [ngModel]="item.userRating" (ngModelChange)="setUserRating(item, +$event)" class="bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer">
                      <option [ngValue]="0" class="bg-zinc-900">--</option>
                      @for (n of ratingOptions; track n) {
                        <option [ngValue]="n" class="bg-zinc-900">{{ n }}</option>
                      }
                    </select>
                    @if (item.userRating > 0) {
                      <span class="text-xs font-semibold text-yellow-400">{{ item.userRating }}/10</span>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-sm font-semibold text-white">{{ formatTime(item.totalMinutes) }}</div>
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    @if (item.seasonsWatched > 1) {
                      <button (click)="changeSeason(item, -1)" class="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all" title="Remove season">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                      </button>
                    }
                    @if (item.seasonsWatched < item.show.number_of_seasons) {
                      <button (click)="changeSeason(item, 1)" class="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all" title="Add season">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                      </button>
                    }
                    <button (click)="removeShow(item.show.id)" class="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete show">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="text-center py-16">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass mb-5">
              <svg class="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-zinc-300 mb-2">No shows yet</h3>
            <p class="text-zinc-600 text-sm">Search for a show to get started</p>
          </div>
        }
      </main>

      <!-- Footer -->
      <footer class="py-8 border-t border-white/5 mt-auto relative z-10">
        <div class="container mx-auto px-4 max-w-4xl">
          <div class="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <div class="flex items-center gap-4 text-zinc-600">
              <span>Data from</span>
              <a href="https://www.tvmaze.com/" target="_blank" rel="noopener noreferrer" class="text-zinc-400 hover:text-white transition-colors">TVMaze</a>
            </div>
            <button (click)="resetAll()" class="text-zinc-600 hover:text-red-400 transition-colors text-sm">Reset data</button>
          </div>
          <div class="mt-6 text-center text-zinc-700 text-xs">
            <p>Calculate the time you have spent watching your favorite shows</p>
          </div>
        </div>
      </footer>

      <!-- Season selector modal -->
      @if (selectedShow) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" (click)="closeModal()">
          <div class="glass-strong rounded-2xl p-6 max-w-md w-full animate-fade-in-scale" (click)="$event.stopPropagation()">
            <div class="flex items-start gap-4 mb-8">
              <img [src]="imageUrl(selectedShow.poster_path)" [alt]="selectedShow.name" class="w-20 h-28 object-cover rounded-xl shadow-2xl" />
              <div class="flex-1">
                <h3 class="text-xl font-bold text-white mb-1">{{ selectedShow.name }}</h3>
                <div class="flex items-center gap-3 text-sm text-zinc-500">
                  <span>{{ selectedShow.number_of_seasons }} seasons</span>
                  <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                  <span>~{{ selectedShow.episode_run_time }} min/ep</span>
                </div>
                @if (selectedShow.rating !== null) {
                  <div class="flex items-center gap-1.5 mt-2 text-sm font-semibold text-amber-400">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                    {{ selectedShow.rating }} <span class="text-zinc-600 font-normal">/ 10 on TVMaze</span>
                  </div>
                }
              </div>
              <button (click)="closeModal()" class="p-1 text-zinc-500 hover:text-white transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="mb-8">
              <label class="block text-sm text-zinc-400 mb-4">Seasons watched</label>
              <div class="flex flex-wrap gap-2">
                @for (season of seasonNumbers; track season) {
                  <button (click)="seasonsToAdd = season" [class]="seasonsToAdd === season ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'" class="w-11 h-11 rounded-xl font-medium transition-all">{{ season }}</button>
                }
              </div>
            </div>
            <button (click)="addShow()" [disabled]="seasonsToAdd === 0" class="w-full py-3.5 px-4 bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-semibold transition-all">Add show</button>
          </div>
        </div>
      }
    </div>
  `
})
export class AppComponent {
  private tvmaze = inject(TvmazeService);

  watchedShows = signal<WatchedShow[]>(this.loadFromStorage());

  searchQuery = '';
  searchResults: TVShow[] = [];
  showDropdown = false;
  isLoading = false;

  selectedShow: TVShow | null = null;
  seasonsToAdd = 0;
  ratingOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  /* Derived totals */
  totalMinutes = computed(() => this.watchedShows().reduce((s, w) => s + w.totalMinutes, 0));
  totalEpisodes = computed(() => this.watchedShows().reduce((s, w) => s + w.episodesWatched, 0));
  days = computed(() => String(Math.floor(this.totalMinutes() / 1440)).padStart(2, '0'));
  hours = computed(() => String(Math.floor((this.totalMinutes() % 1440) / 60)).padStart(2, '0'));
  minutes = computed(() => String(this.totalMinutes() % 60).padStart(2, '0'));

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
  }

  /* ---------------------- Search UI ---------------------- */
  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  selectShow(show: TVShow): void {
    this.isLoading = true;
    this.tvmaze.getShowDetails(show.id).subscribe(result => {
      this.isLoading = false;
      if (!result) return;
      this.selectedShow = result;
      this.seasonsToAdd = 0;
      this.showDropdown = false;
      this.searchQuery = '';
      this.searchResults = [];
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
    if (this.watchedShows().some(w => w.show.id === this.selectedShow!.id)) {
      this.closeModal();
      return;
    }
    const t = this.calculateTime(this.selectedShow, this.seasonsToAdd);
    this.watchedShows.update(list => [...list, {
      show: this.selectedShow!,
      seasonsWatched: this.seasonsToAdd,
      totalMinutes: t.minutes,
      episodesWatched: t.episodes,
      userRating: 0
    }]);
    this.save();
    this.closeModal();
  }

  changeSeason(item: WatchedShow, delta: number): void {
    const newSeasons = item.seasonsWatched + delta;
    if (newSeasons < 1 || newSeasons > item.show.number_of_seasons) return;
    const t = this.calculateTime(item.show, newSeasons);
    this.watchedShows.update(list => list.map(w =>
      w.show.id === item.show.id ? { ...w, seasonsWatched: newSeasons, totalMinutes: t.minutes, episodesWatched: t.episodes } : w
    ));
    this.save();
  }

  removeShow(id: number): void {
    this.watchedShows.update(list => list.filter(w => w.show.id !== id));
    this.save();
  }

  setUserRating(item: WatchedShow, rating: number): void {
    this.watchedShows.update(list => list.map(w =>
      w.show.id === item.show.id ? { ...w, userRating: rating } : w
    ));
    this.save();
  }

  resetAll(): void {
    if (confirm('Are you sure you want to delete all shows?')) {
      this.watchedShows.set([]);
      this.save();
    }
  }

  closeModal(): void {
    this.selectedShow = null;
    this.seasonsToAdd = 0;
  }

  /* ---------------------- Helpers ---------------------- */
  imageUrl(path: string | null): string {
    return path || 'https://via.placeholder.com/210x295/1e293b/6366f1?text=No+Image';
  }

  formatTime(minutes: number): string {
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  /* ---------------------- Storage ---------------------- */
  private save(): void {
    localStorage.setItem('watchedShows', JSON.stringify(this.watchedShows()));
  }

  private loadFromStorage(): WatchedShow[] {
    try {
      return JSON.parse(localStorage.getItem('watchedShows') || '[]');
    } catch {
      return [];
    }
  }
}
