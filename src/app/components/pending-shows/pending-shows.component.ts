import { Component, input, output } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { PendingShow, TVShow } from '../../models';

@Component({
  selector: 'app-pending-shows',
  standalone: true,
  imports: [SlicePipe],
  template: `
    @if (pendingShows().length > 0) {
      <div class="mt-12 animate-fade-in">
        <div class="flex items-baseline justify-between mb-4 border-b border-white/5 pb-2">
          <div class="flex items-center gap-3">
            <h2 class="text-2xl font-bold tracking-tight text-white">Pending Shows</h2>
            <span class="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-semibold border border-violet-500/30">{{ pendingShows().length }}</span>
          </div>
          <span class="text-xs text-zinc-500 font-medium">To watch</span>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-0 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          @for (item of pendingShows(); track item.id; let i = $index) {
            <div class="relative aspect-[2/3] overflow-hidden group animate-slide-up" [style.animation-delay]="i * 50 + 'ms'">

              <!-- Poster Image -->
              @if (item.show.poster_path) {
                <img [src]="item.show.poster_path" [alt]="item.show.name"
                     class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              } @else {
                <div class="absolute inset-0 bg-gradient-to-b from-violet-900/40 to-slate-900 flex items-center justify-center">
                  <svg class="w-10 h-10 text-violet-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                </div>
              }

              <!-- Pending badge (hidden on hover) -->
              <div class="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-violet-600/80 backdrop-blur-sm text-white text-[9px] font-bold pointer-events-none flex items-center gap-1 group-hover:opacity-0 transition-opacity duration-200">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Pending
              </div>

              <!-- Delete Button (always visible, hidden on hover to avoid conflict) -->
              <button (click)="removePending.emit(item.id); $event.stopPropagation()"
                      class="absolute top-2 right-2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-violet-500 bg-black/70 text-violet-300 hover:bg-violet-500 hover:text-white transition-all flex items-center justify-center active:scale-95 group-hover:opacity-0 pointer-events-none group-hover:pointer-events-none"
                      title="Remove from pending">
                <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>

              <!-- Bottom Info (hidden on hover) -->
              <div class="absolute bottom-0 inset-x-0 p-2 sm:p-3 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none flex items-end z-10 group-hover:opacity-0 transition-opacity duration-200">
                <h4 class="text-white text-xs sm:text-sm font-bold leading-tight line-clamp-1 drop-shadow-md">{{ item.show.name }}</h4>
              </div>

              <!-- Hover Overlay (z-20 to sit above everything) -->
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/90 backdrop-blur-sm flex flex-col justify-between p-2 sm:p-4 cursor-pointer z-20"
                   (click)="openDetails.emit(item.show)">

                <!-- Top: title + remove -->
                <div class="flex items-start justify-between gap-1">
                  <div class="min-w-0">
                    <h3 class="font-extrabold text-white text-xs sm:text-base leading-tight line-clamp-2 hover:text-violet-400 transition-colors">{{ item.show.name }}</h3>
                    <div class="text-[9px] sm:text-xs text-zinc-400 mt-0.5">{{ item.show.first_air_date | slice:0:4 }}</div>
                  </div>
                  <button (click)="removePending.emit(item.id); $event.stopPropagation()"
                          class="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0 ml-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>

                <!-- Bottom: rating + CTA -->
                <div class="space-y-1.5">
                  @if (item.show.rating !== null) {
                    <div class="flex items-center gap-1 text-amber-400 text-xs font-bold">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                      {{ item.show.rating }}
                    </div>
                  }
                  <button (click)="markAsWatched.emit(item); $event.stopPropagation()"
                          class="w-full py-1.5 sm:py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    Mark as watched
                  </button>
                </div>
              </div>

            </div>
          }
        </div>
      </div>
    }
  `
})
export class PendingShowsComponent {
  pendingShows = input.required<PendingShow[]>();

  openDetails = output<TVShow>();
  removePending = output<string>();
  markAsWatched = output<PendingShow>();
}
