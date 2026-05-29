import { Component, input } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <div class="glass-strong rounded-3xl p-8 md:p-12 mb-10 animate-fade-in">
      <div class="flex items-stretch justify-center gap-2 md:gap-6">
        <div class="flex-1 text-center group">
          <div class="relative flex items-center justify-center rounded-2xl py-4 transition-colors group-hover:bg-white/[0.03]">
            <div class="text-5xl md:text-8xl font-bold tracking-tighter text-white tabular-nums">
              @for (char of days().split(''); track $index + '-' + char) {
                <span class="animate-count-pop">{{ char }}</span>
              }
            </div>
          </div>
          <div class="text-zinc-500 text-xs md:text-sm uppercase tracking-[0.2em] mt-2 font-medium">Days</div>
        </div>
        <div class="flex items-center pb-10 text-4xl md:text-6xl font-light text-zinc-700">:</div>
        <div class="flex-1 text-center group">
          <div class="relative flex items-center justify-center rounded-2xl py-4 transition-colors group-hover:bg-white/[0.03]">
            <div class="text-5xl md:text-8xl font-bold tracking-tighter text-white tabular-nums">
              @for (char of hours().split(''); track $index + '-' + char) {
                <span class="animate-count-pop">{{ char }}</span>
              }
            </div>
          </div>
          <div class="text-zinc-500 text-xs md:text-sm uppercase tracking-[0.2em] mt-2 font-medium">Hours</div>
        </div>
        <div class="flex items-center pb-10 text-4xl md:text-6xl font-light text-zinc-700">:</div>
        <div class="flex-1 text-center group">
          <div class="relative flex items-center justify-center rounded-2xl py-4 transition-colors group-hover:bg-white/[0.03]">
            <div class="text-5xl md:text-8xl font-bold tracking-tighter text-white tabular-nums">
              @for (char of minutes().split(''); track $index + '-' + char) {
                <span class="animate-count-pop">{{ char }}</span>
              }
            </div>
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
            <span class="text-zinc-400"><span class="text-white font-semibold tabular-nums">{{ watchedShowsCount() }}</span> shows</span>
          </div>
        </div>
      }
    </div>
  `
})
export class CounterComponent {
  days = input.required<string>();
  hours = input.required<string>();
  minutes = input.required<string>();
  totalEpisodes = input.required<number>();
  watchedShowsCount = input.required<number>();
}
