import { Component, signal, computed, inject, effect, OnInit, OnDestroy } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TVShow, WatchedShow } from './models';
import { TvmazeService } from './services/tvmaze.service';
import { CounterComponent } from './components/counter/counter.component';
import { YourShowsComponent } from './components/your-shows/your-shows.component';
import { TrendingComponent } from './components/trending/trending.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SlicePipe, FormsModule, CounterComponent, YourShowsComponent, TrendingComponent],
  template: `
    <div class="min-h-screen flex flex-col relative overflow-hidden">
      <!-- Dynamic series background slideshow -->
      <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <!-- Background 1 -->
        @if (bgImage1()) {
          <img 
            [src]="bgImage1()" 
            class="absolute inset-0 w-full h-full object-cover"
            style="transition: opacity 2s ease-in-out;"
            [style.opacity]="bg1Visible() ? 0.35 : 0"
            alt=""
          />
        }
        <!-- Background 2 -->
        @if (bgImage2()) {
          <img 
            [src]="bgImage2()" 
            class="absolute inset-0 w-full h-full object-cover"
            style="transition: opacity 2s ease-in-out;"
            [style.opacity]="!bg1Visible() ? 0.35 : 0"
            alt=""
          />
        }
        
        <!-- Aurora blobs overlay -->
        <div class="aurora-blob absolute -top-32 left-1/4 w-[40rem] h-[40rem] bg-rose-500/10 rounded-full blur-[120px]"></div>
        <div class="aurora-blob absolute top-1/3 -right-32 w-[36rem] h-[36rem] bg-red-500/10 rounded-full blur-[120px]" style="animation-delay: -6s;"></div>
        <div class="aurora-blob absolute bottom-0 left-1/3 w-[32rem] h-[32rem] bg-amber-500/5 rounded-full blur-[120px]" style="animation-delay: -12s;"></div>
        
        <!-- Grid pattern overlay -->
        <div class="absolute inset-0" style="background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px); background-size: 60px 60px;"></div>
        <!-- Vignette/Shadows overlay -->
        <div class="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950"></div>
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

      <main class="flex-1 container mx-auto px-4 md:px-8 py-8 max-w-[1600px] relative z-10">
        <!-- Counter Component -->
        <app-counter 
          [days]="days()" 
          [hours]="hours()" 
          [minutes]="minutes()" 
          [totalEpisodes]="totalEpisodes()" 
          [watchedShowsCount]="watchedShows().length">
        </app-counter>

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
                  <img [src]="show.poster_path" [alt]="show.name" class="w-10 h-14 object-cover rounded-lg" />
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

        <!-- Watchlist (Your Shows) -->
        @if (watchedShows().length > 0) {
          <app-your-shows
            [watchedShows]="watchedShows()"
            (openDetails)="openDetails($event)"
            (changeSeason)="changeSeason($event.item, $event.delta)"
            (removeShow)="removeShow($event)"
            (setUserRating)="setUserRating($event.item, $event.rating)">
          </app-your-shows>
        } @else {
          <div class="text-center py-16">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass mb-5">
              <svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-zinc-200 mb-2">No shows yet</h2>
            <p class="text-zinc-400 text-sm">Search or choose a trending show below to get started</p>
          </div>
        }

        <!-- Trending Section -->
        @defer (on idle) {
          <app-trending 
            (openDetails)="openDetails($event)">
          </app-trending>
        }
      </main>

      <!-- Footer -->
      <footer class="py-8 border-t border-white/5 mt-auto relative z-10">
        <div class="container mx-auto px-4 md:px-8 max-w-[1600px]">
          <div class="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <div class="flex items-center gap-4 text-zinc-400">
              <span>Data from</span>
              <a href="https://www.tvmaze.com/" target="_blank" rel="noopener noreferrer" class="text-zinc-400 hover:text-white transition-colors">TVMaze</a>
            </div>
            <button (click)="resetAll()" class="text-zinc-400 hover:text-red-400 transition-colors text-sm">Reset data</button>
          </div>
          <div class="mt-6 text-center text-zinc-500 text-xs">
            <p>Calculate the time you have spent watching your favorite shows</p>
          </div>
        </div>
      </footer>

      <!-- Season selector modal -->
      @if (selectedShow) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" (click)="closeModal()">
          <div class="glass-strong rounded-2xl p-6 max-w-md w-full animate-fade-in-scale" (click)="$event.stopPropagation()">
            <div class="flex items-start gap-4 mb-8">
              <img [src]="selectedShow.poster_path" [alt]="selectedShow.name" class="w-20 h-28 object-cover rounded-xl shadow-2xl" />
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

      <!-- Show details modal -->
      @if (activeShowForDetails()) {
        <div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" (click)="closeDetailsModal()">
          <div class="glass-strong rounded-3xl p-6 md:p-8 max-w-2xl w-full animate-fade-in-scale relative overflow-hidden" (click)="$event.stopPropagation()">
            <!-- Close button -->
            <button (click)="closeDetailsModal()" class="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all z-10">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div class="flex flex-col md:flex-row gap-6 relative">
              <!-- Poster -->
              <div class="w-full md:w-48 shrink-0 flex justify-center md:block">
                <img [src]="activeShowForDetails()!.poster_path" [alt]="activeShowForDetails()!.name" class="w-40 h-56 md:w-48 md:h-68 object-cover rounded-2xl shadow-2xl border border-white/10" />
              </div>
              
              <!-- Content -->
              <div class="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 class="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">{{ activeShowForDetails()!.name }}</h3>
                  
                  <div class="flex flex-wrap items-center gap-3 text-xs md:text-sm text-zinc-400 mb-4">
                    <span>{{ activeShowForDetails()!.first_air_date | slice:0:4 }}</span>
                    @if (activeShowForDetails()!.number_of_seasons) {
                      <span class="w-1 h-1 rounded-full bg-zinc-600"></span>
                      <span>{{ activeShowForDetails()!.number_of_seasons }} seasons</span>
                    }
                    <span class="w-1 h-1 rounded-full bg-zinc-600"></span>
                    <span>~{{ activeShowForDetails()!.episode_run_time }} min/ep</span>
                    @if (activeShowForDetails()!.rating !== null) {
                      <span class="w-1 h-1 rounded-full bg-zinc-600"></span>
                      <span class="flex items-center gap-1 font-semibold text-amber-400">
                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                        {{ activeShowForDetails()!.rating }}/10
                      </span>
                    }
                  </div>
                  
                  <!-- Scrollable Summary -->
                  <div class="text-zinc-300 text-sm leading-relaxed mb-6 max-h-48 overflow-y-auto pr-2" [innerHTML]="activeShowForDetails()!.summary || '<p class=text-zinc-500>No description available.</p>'"></div>
                </div>
                
                 <!-- Action section inside Details Modal -->
                <div class="pt-4 border-t border-white/5 mt-auto">
                  @let instances = getShowInstances(activeShowForDetails()!.id);
                  <div class="flex flex-col gap-4">
                    @if (instances.length > 0) {
                      <div class="flex items-center justify-between text-sm text-zinc-400">
                        <span class="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                          <span>Added {{ instances.length }} {{ instances.length === 1 ? 'time' : 'times' }}</span>
                        </span>
                      </div>
                      
                      <!-- Render controls for each instance -->
                      <div class="space-y-3 max-h-48 overflow-y-auto pr-1">
                        @for (watchedItem of instances; track watchedItem.instanceId; let idx = $index) {
                          <div class="flex flex-wrap items-center justify-between gap-4 bg-white/5 rounded-xl p-3 border border-white/5 text-xs">
                            <div class="font-semibold text-zinc-300">Copy #{{ idx + 1 }}</div>
                            <!-- Seasons -->
                            <div class="flex items-center gap-2">
                              <span class="text-zinc-500 uppercase text-[9px] font-bold">Seasons:</span>
                              <span class="text-white font-extrabold">{{ watchedItem.seasonsWatched }}/{{ watchedItem.show.number_of_seasons }}</span>
                              <div class="flex items-center gap-0.5">
                                @if (watchedItem.seasonsWatched > 1) {
                                  <button (click)="changeSeason(watchedItem, -1)" class="p-1 rounded bg-white/5 text-zinc-400 hover:text-white transition-all">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                                  </button>
                                }
                                @if (watchedItem.seasonsWatched < watchedItem.show.number_of_seasons) {
                                  <button (click)="changeSeason(watchedItem, 1)" class="p-1 rounded bg-white/5 text-zinc-300 hover:text-white transition-all">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                                  </button>
                                }
                              </div>
                            </div>
                            
                            <!-- Rating -->
                            <div class="flex items-center gap-1.5">
                              <span class="text-zinc-500 uppercase text-[9px] font-bold">Rating:</span>
                              <select [ngModel]="watchedItem.userRating" (ngModelChange)="setUserRating(watchedItem, +$event)" class="bg-zinc-800 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer">
                                <option [ngValue]="0">--</option>
                                @for (n of ratingOptions; track n) {
                                  <option [ngValue]="n">{{ n }}</option>
                                }
                              </select>
                            </div>

                            <!-- Delete -->
                            <button (click)="removeShow(watchedItem.instanceId); (getShowInstances(activeShowForDetails()!.id).length === 0 ? closeDetailsModal() : null)" class="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0" title="Delete copy">
                              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </div>
                        }
                      </div>
                    }

                    <!-- Button to add another copy / new show -->
                    <button (click)="closeDetailsModal(); selectShow(activeShowForDetails()!)" class="px-5 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center gap-2 w-full justify-center">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                      <span>{{ instances.length > 0 ? 'Add another copy' : 'Add to watchlist' }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  private tvmaze = inject(TvmazeService);

  watchedShows = signal<WatchedShow[]>(this.loadFromStorage());
  activeShowForDetails = signal<TVShow | null>(null);

  searchQuery = '';
  searchResults: TVShow[] = [];
  showDropdown = false;
  isLoading = false;

  selectedShow: TVShow | null = null;
  seasonsToAdd = 0;
  ratingOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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
    this.activeShowForDetails.set(null);
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
      this.save();
    }
  }

  closeModal(): void {
    this.selectedShow = null;
    this.seasonsToAdd = 0;
  }


  /* ---------------------- Storage ---------------------- */
  private save(): void {
    localStorage.setItem('watchedShows', JSON.stringify(this.watchedShows()));
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
}
