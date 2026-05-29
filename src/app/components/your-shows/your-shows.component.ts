import { Component, input, output } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WatchedShow, TVShow } from '../../models';

@Component({
  selector: 'app-your-shows',
  standalone: true,
  imports: [SlicePipe, FormsModule],
  template: `
    @if (watchedShows().length > 0) {
      <div class="space-y-4">
        <div class="flex items-baseline justify-between mb-4 border-b border-white/5 pb-2">
          <h2 class="text-2xl font-bold tracking-tight text-white">Your Shows</h2>
          <span class="text-xs text-zinc-500 font-medium">{{ watchedShows().length }} shows</span>
        </div>
        
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-0 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          @for (item of watchedShows(); track item.instanceId; let i = $index) {
            <div class="relative aspect-[2/3] overflow-hidden group animate-slide-up" [style.animation-delay]="i * 50 + 'ms'">
              <!-- Poster Image -->
              <img [src]="item.show.poster_path" [alt]="item.show.name" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              
              <!-- Blue Trash Can Button for mobile/tablet (no hover) -->
              <button (click)="removeShow.emit(item.instanceId); $event.stopPropagation()" 
                      class="absolute top-2 right-2 z-20 md:hidden p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg backdrop-blur-sm transition-all active:scale-95 flex items-center justify-center border border-blue-500/30" 
                      title="Delete show">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
              
              <!-- Glassmorphic Hover Overlay -->
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/85 backdrop-blur-md flex flex-col justify-between p-2 sm:p-5 select-none cursor-pointer"
                   (click)="openDetails.emit(item.show)">
                
                <!-- Top: Title & Delete button -->
                <div class="flex items-start justify-between gap-1">
                  <div class="min-w-0">
                    <h3 class="font-extrabold text-white text-xs sm:text-xl md:text-2xl leading-tight truncate hover:text-blue-400 transition-colors" title="{{ item.show.name }}">{{ item.show.name }}</h3>
                    <div class="text-[9px] sm:text-xs text-zinc-400 mt-0.5">{{ item.show.first_air_date | slice:0:4 }}</div>
                  </div>
                  <button (click)="removeShow.emit(item.instanceId); $event.stopPropagation()" class="p-1 rounded bg-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0 animate-fade-in" title="Delete show">
                    <svg class="w-3 h-3 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
                
                <!-- Middle: Stats & Controls -->
                <div class="space-y-1 sm:space-y-3 my-auto">
                  <!-- Rating and Time -->
                  <div class="flex items-center justify-between text-[10px] sm:text-sm text-zinc-200">
                    <span class="font-black text-white text-xs sm:text-base md:text-lg">{{ formatTime(item.totalMinutes) }}</span>
                    @if (item.show.rating !== null) {
                      <span class="flex items-center gap-0.5 text-amber-400 font-bold">
                        <svg class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                        {{ item.show.rating }}
                      </span>
                    }
                  </div>

                  <!-- Seasons Watched / Total Seasons + Add/Remove buttons -->
                  <div class="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-1 sm:p-2 gap-1">
                    <div class="min-w-0">
                      <div class="text-[7px] sm:text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Seasons</div>
                      <div class="text-[10px] sm:text-base text-white font-extrabold truncate">{{ item.seasonsWatched }}/{{ item.show.number_of_seasons }}</div>
                    </div>
                    <div class="flex items-center gap-0.5 shrink-0">
                      @if (item.seasonsWatched > 1) {
                        <button (click)="changeSeason.emit({ item, delta: -1 }); $event.stopPropagation()" class="p-0.5 sm:p-1.5 rounded bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-all" title="Remove season">
                          <svg class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"></path></svg>
                        </button>
                      }
                      @if (item.seasonsWatched < item.show.number_of_seasons) {
                        <button (click)="changeSeason.emit({ item, delta: 1 }); $event.stopPropagation()" class="p-0.5 sm:p-1.5 rounded bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-all" title="Add season">
                          <svg class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                        </button>
                      }
                    </div>
                  </div>
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
      </div>
    }
  `
})
export class YourShowsComponent {
  watchedShows = input.required<WatchedShow[]>();
  
  openDetails = output<TVShow>();
  changeSeason = output<{ item: WatchedShow; delta: number }>();
  removeShow = output<string>();
  setUserRating = output<{ item: WatchedShow; rating: number }>();

  ratingOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  formatTime(minutes: number): string {
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
}
