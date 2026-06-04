import { Component, inject, signal, OnInit, output, input } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { TVShow, PendingShow } from '../../models';
import { TvmazeService } from '../../services/tvmaze.service';

@Component({
  selector: 'app-trending',
  standalone: true,
  imports: [SlicePipe],
  template: `
    @if (trendingShows().length > 0) {
      <div class="mt-14 animate-fade-in">
        <div class="flex items-center justify-between mb-6 border-b border-white/5 pb-2">
          <div class="flex items-baseline gap-2">
            <h2 class="text-2xl font-bold tracking-tight text-white">Top Rated Shows</h2>
            <span class="text-xs text-zinc-400 font-medium">Top 10</span>
          </div>
          <button (click)="viewAll.emit()" class="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
            View all (Top 250)
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory no-scrollbar">
          @for (show of trendingShows(); track show.id) {
            <div (click)="openDetails.emit(show)" class="flex-none w-60 glass rounded-2xl p-3 flex flex-col hover-lift cursor-pointer group snap-start">
              <div class="relative aspect-[2/3] overflow-hidden rounded-xl mb-3 shadow-md">
                <img [src]="show.poster_path" [alt]="show.name" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                @if (show.rating !== null) {
                  <div class="absolute top-2 right-2 px-2 py-0.5 bg-black/75 backdrop-blur-md rounded-md flex items-center gap-1 text-[11px] font-bold text-amber-400 border border-white/5">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
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
                        
                        @if (isInPending(show.id)) {
                          <button
                            (click)="removePending.emit(show.id); activeSearchDropdownShow.set(null); $event.stopPropagation()"
                            class="w-full py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            Remove pending
                          </button>
                        } @else {
                          <button
                            (click)="addToPending.emit(show); activeSearchDropdownShow.set(null); $event.stopPropagation()"
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
              <h3 class="font-semibold text-white text-sm truncate group-hover:text-blue-400 transition-colors">{{ show.name }}</h3>
              <p class="text-xs text-zinc-400 mt-1">{{ show.first_air_date | slice:0:4 }}</p>
            </div>
          }
        </div>
      </div>
    }
  `
})
export class TrendingComponent implements OnInit {
  private tvmaze = inject(TvmazeService);
  trendingShows = signal<TVShow[]>([]);

  // Inputs for pending state checks
  pendingShows = input<PendingShow[]>([]);

  // Outputs to bubble actions to parent component
  openDetails = output<TVShow>();
  viewAll = output<void>();
  addShow = output<{ show: TVShow; seasons: number }>();
  addToPending = output<TVShow>();
  removePending = output<number>();

  // Local dropdown state
  activeSearchDropdownShow = signal<TVShow | null>(null);
  searchDropdownSeasonsToAdd = 0;
  searchDropdownLoading = false;

  ngOnInit(): void {
    this.tvmaze.getTopRatedShows().subscribe(shows => {
      this.trendingShows.set(shows.slice(0, 10));
    });
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
    this.addShow.emit({ show, seasons: this.searchDropdownSeasonsToAdd });
    this.activeSearchDropdownShow.set(null);
    this.searchDropdownSeasonsToAdd = 0;
  }

  isInPending(showId: number): boolean {
    return this.pendingShows().some(p => p.show.id === showId);
  }
}
