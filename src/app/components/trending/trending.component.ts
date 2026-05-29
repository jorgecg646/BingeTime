import { Component, input, output } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { TVShow } from '../../models';

@Component({
  selector: 'app-trending',
  standalone: true,
  imports: [SlicePipe],
  template: `
    @if (trendingShows().length > 0) {
      <div class="mt-14 animate-fade-in">
        <div class="flex items-baseline justify-between mb-6 border-b border-white/5 pb-2">
          <h2 class="text-2xl font-bold tracking-tight text-white">Trending on BingeTime</h2>
          <span class="text-xs text-zinc-500 font-medium">Popular shows</span>
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
              </div>
              <h3 class="font-semibold text-white text-sm truncate group-hover:text-blue-400 transition-colors">{{ show.name }}</h3>
              <p class="text-xs text-zinc-500 mt-1">{{ show.first_air_date | slice:0:4 }}</p>
            </div>
          }
        </div>
      </div>
    }
  `
})
export class TrendingComponent {
  trendingShows = input.required<TVShow[]>();
  
  openDetails = output<TVShow>();
}
