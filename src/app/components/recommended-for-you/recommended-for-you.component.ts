import { Component, signal, computed, inject, effect, ChangeDetectionStrategy, ElementRef, ViewChild } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TVShow, WatchedShow } from '../../models';
import { ShowStateService } from '../../services/show-state.service';
import { TmdbService } from '../../services/tmdb.service';

interface RecommendedShowItem {
  show: TVShow;
  matchScore: number;
  seedTitle: string;
}

@Component({
  selector: 'app-recommended-for-you',
  standalone: true,
  imports: [SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recommendations().length > 0) {
      <div class="mt-14 mb-10 animate-fade-in relative z-10">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5 border-b border-white/5 pb-3">
          <div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-sm shadow-lg shadow-violet-500/20">✨</div>
              <h2 class="text-2xl sm:text-3xl font-black tracking-tight text-white">Recommended For You</h2>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                <span>⚡</span><span>Ranked by Match</span>
              </span>
            </div>
            <p class="text-xs sm:text-sm text-zinc-400 mt-1.5 ml-11">{{ recommendationReason() }}</p>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto">
            <button (click)="scrollCarousel(-550)" class="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-md" title="Scroll left">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <button (click)="scrollCarousel(550)" class="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-md" title="Scroll right">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>

        <div #carouselRef class="flex gap-5 overflow-x-auto pb-6 pt-2 scroll-smooth no-scrollbar" style="contain: content;">
          @for (item of recommendations(); track item.show.id) {
            <div class="flex-none relative w-72 sm:w-80 md:w-96 aspect-[16/10] rounded-2xl overflow-hidden shadow-2xl group cursor-pointer border border-white/10 hover:border-violet-500/60 transition-all duration-500 bg-zinc-950 flex flex-col justify-between"
                 (click)="state.openDetails(item.show)">
              <img [src]="item.show.backdrop_path || item.show.poster_path" [alt]="item.show.name" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 filter group-hover:brightness-105" loading="lazy" decoding="async" />
              <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20 z-10 pointer-events-none"></div>

              <div class="relative z-20 p-3.5 flex items-center justify-between">
                <div class="px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-emerald-400/30 text-emerald-400 text-xs font-black tracking-wide flex items-center gap-1.5 shadow-lg">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{{ item.matchScore }}% MATCH</span>
                </div>
                @if (item.show.rating) {
                  <div class="px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-amber-400/30 text-amber-400 text-xs font-black flex items-center gap-1 shadow-lg">
                    <span>★</span><span>{{ item.show.rating }}</span>
                  </div>
                }
              </div>

              <div class="relative z-20 p-4">
                <div class="mb-1.5">
                  <span class="text-[10px] font-bold text-violet-300 uppercase tracking-wider">Because you watched {{ item.seedTitle }}</span>
                  <h4 class="text-base sm:text-lg font-black text-white truncate leading-tight group-hover:text-violet-200 transition-colors drop-shadow-md">{{ item.show.name }}</h4>
                </div>
                <div class="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                  <div class="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                    <span>{{ item.show.first_air_date | slice:0:4 }}</span>
                    <span>•</span>
                    <span>{{ item.show.number_of_seasons ? item.show.number_of_seasons + ' seasons' : (item.show.genres?.[0] || 'TV') }}</span>
                  </div>
                  <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()">
                    <button (click)="state.addToPending(item.show)" class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-violet-600/70 text-white text-xs font-bold border border-white/15 transition-all flex items-center gap-1 active:scale-95 shadow">
                      <svg class="w-3 h-3 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <span class="hidden sm:inline">Watchlist</span>
                    </button>
                    <button (click)="state.addDetailsShowToWatched(item.show)" class="p-1.5 rounded-lg bg-white/10 hover:bg-emerald-600/70 text-emerald-300 hover:text-white border border-white/15 transition-all active:scale-95 shadow" title="Mark as Watched">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          }
        </div>
      </div>
    }
  `
})
export class RecommendedForYouComponent {
  state = inject(ShowStateService);
  private tmdb = inject(TmdbService);

  recommendations = signal<RecommendedShowItem[]>([]);
  isLoading = signal<boolean>(false);

  @ViewChild('carouselRef') carouselRef?: ElementRef<HTMLDivElement>;

  recommendationReason = computed(() => {
    const names = Array.from(new Set(this.state.watchedShows().map(w => w.show.name)));
    if (!names.length) return 'Discover TV shows tailored to your taste.';
    return `Picks ranked by affinity across ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' and more' : ''}.`;
  });

  constructor() {
    effect(() => {
      // Re-run whenever the user adds, removes, or modifies watched or pending shows
      this.state.watchedShows();
      this.state.pendingShows();
      this.generateRecommendations();
    });
  }

  scrollCarousel(offset: number) {
    this.carouselRef?.nativeElement.scrollBy({ left: offset, behavior: 'smooth' });
  }

  private generateRecommendations() {
    const watched = this.state.watchedShows();
    if (!watched.length) return;

    this.isLoading.set(true);

    const userGenres = new Set(watched.flatMap(w => w.show.genres || []));
    const uniqueSeeds = Array.from(new Map(watched.map(w => [w.show.id, w])).values()).slice(0, 10);

    forkJoin(uniqueSeeds.map(ws => this.tmdb.getRecommendationsForShow(ws.show.id).pipe(catchError(() => of([])))))
      .subscribe(results => {
        this.isLoading.set(false);
        const exclude = new Set([...watched.map(w => w.show.id), ...this.state.pendingShows().map(p => p.show.id)]);
        const candidateMap = new Map<number, RecommendedShowItem>();

        results.forEach((showList, idx) => {
          const seed = uniqueSeeds[idx];
          showList.forEach((c, rank) => {
            if (!exclude.has(c.id) && (c.backdrop_path || c.poster_path)) {
              let score = 70 + Math.round(((seed.userRating || 8) / 10) * 15);
              if (c.rating && c.rating >= 8.0) score += 6;
              else if (c.rating && c.rating >= 7.0) score += 3;
              score += Math.min(10, (c.genres || []).filter(g => userGenres.has(g)).length * 3);
              score += Math.max(0, 4 - Math.floor(rank / 3));
              const matchScore = Math.min(99, Math.max(76, score));

              if (!candidateMap.has(c.id) || candidateMap.get(c.id)!.matchScore < matchScore) {
                candidateMap.set(c.id, { show: c, matchScore, seedTitle: seed.show.name });
              }
            }
          });
        });

        this.recommendations.set(
          Array.from(candidateMap.values())
            .sort((a, b) => b.matchScore !== a.matchScore ? b.matchScore - a.matchScore : (b.show.rating || 0) - (a.show.rating || 0))
            .slice(0, 24)
        );
      });
  }
}
