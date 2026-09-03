import { Component, signal, computed, inject, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShowStateService } from '../../services/show-state.service';
import { TmdbService } from '../../services/tmdb.service';
import { TVShow } from '../../models';

interface GenreStat { name: string; count: number; percentage: number; color: string; }
interface PlatformStat { name: string; count: number; logoUrl?: string; hours: number; }
interface ActorStat { id: number; name: string; profilePath?: string; count: number; shows: string[]; }
interface Badge { id: string; name: string; desc: string; icon: string; unlocked: boolean; progressText: string; progressPercent: number; color: string; }

@Component({
  selector: 'app-stats-wrapped',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in relative z-10">

      <!-- Breadcrumb / Back button -->
      <div class="flex items-center justify-between mb-6">
        <a routerLink="/" class="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors group">
          <svg class="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
          <span>Back to Your Shows</span>
        </a>

        <button 
          (click)="showStoryModal.set(true)"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-violet-600/30 transition-all active:scale-95 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          <span>Generate Story Card</span>
        </button>
      </div>

      <!-- Hero Wrapped Header -->
      <div class="relative overflow-hidden rounded-3xl p-8 sm:p-12 mb-10 bg-gradient-to-br from-violet-950/70 via-slate-950/90 to-fuchsia-950/60 border border-white/15 shadow-2xl backdrop-blur-xl">
        <div class="absolute -top-24 -right-24 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -left-24 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10 text-center max-w-3xl mx-auto">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-black uppercase tracking-widest text-fuchsia-300 mb-4">
            <span>✨</span><span>Your BingeTime Wrapped</span><span>✨</span>
          </div>

          <h1 class="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4">
            Your Life in TV Series
          </h1>
          <p class="text-zinc-400 text-sm sm:text-base mb-8">
            An in-depth visual dive into every hour, genre, actor, and streaming platform you've experienced.
          </p>

          <!-- Big Binge Counters -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto">
            <div class="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
              <span class="block text-2xl sm:text-4xl font-black text-white tabular-nums">{{ state.days() }}</span>
              <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Days</span>
            </div>
            <div class="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
              <span class="block text-2xl sm:text-4xl font-black text-white tabular-nums">{{ state.hours() }}</span>
              <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Hours</span>
            </div>
            <div class="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
              <span class="block text-2xl sm:text-4xl font-black text-white tabular-nums">{{ state.minutes() }}</span>
              <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Minutes</span>
            </div>
            <div class="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
              <span class="block text-2xl sm:text-4xl font-black text-emerald-400 tabular-nums">{{ state.totalEpisodes() }}</span>
              <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Episodes</span>
            </div>
          </div>

          <!-- Secondary summary pills -->
          <div class="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-zinc-400">
            <span><strong class="text-white">{{ state.watchedShows().length }}</strong> series logged</span>
            <span>•</span>
            <span><strong class="text-amber-400">★ {{ averageUserRating() | number:'1.1-1' }}</strong> avg rating</span>
            @if (rewatchCount() > 0) {
              <span>•</span>
              <span class="text-emerald-300"><strong class="text-white">{{ rewatchCount() }}</strong> re-watched</span>
            }
          </div>
        </div>
      </div>

      <!-- MAIN GRID: 2 Columns -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">

        <!-- 1. Top Genres Breakdown -->
        <div class="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 text-lg shadow-sm">
                🎭
              </div>
              <div>
                <h2 class="text-lg sm:text-xl font-bold text-white">Favorite Genres</h2>
                <p class="text-xs text-zinc-400">Distribution of genres across your series</p>
              </div>
            </div>

            @if (topGenres().length > 0) {
              <div class="space-y-3.5 mb-6">
                @for (g of topGenres(); track g.name) {
                  <div>
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-bold text-white flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full" [style.background-color]="g.color"></span>
                        <span>{{ g.name }}</span>
                      </span>
                      <span class="text-zinc-400 font-semibold">{{ g.count }} shows · <strong class="text-white">{{ g.percentage }}%</strong></span>
                    </div>
                    <div class="w-full h-2.5 rounded-full bg-white/5 overflow-hidden border border-white/5">
                      <div class="h-full rounded-full transition-all duration-1000 ease-out" [style.width.%]="g.percentage" [style.background-color]="g.color"></div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="py-12 text-center text-zinc-500 text-sm">No genre statistics available.</div>
            }
          </div>

          @if (topGenres().length > 0) {
            <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 flex items-center gap-3">
              <span class="text-xl">💡</span>
              <p>Your primary taste leans strongly towards <strong class="text-fuchsia-300">{{ topGenres()[0].name }}</strong> ({{ topGenres()[0].percentage }}% of your time).</p>
            </div>
          }
        </div>

        <!-- 2. Top Streaming Platforms -->
        <div class="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg shadow-sm">
                📺
              </div>
              <div>
                <h2 class="text-lg sm:text-xl font-bold text-white">Top Streaming Networks</h2>
                <p class="text-xs text-zinc-400">Where your watched series originated</p>
              </div>
            </div>

            @if (topPlatforms().length > 0) {
              <div class="space-y-3 mb-6">
                @for (plat of topPlatforms(); track plat.name; let idx = $index) {
                  <div class="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between gap-3 hover:border-white/20 transition-all">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="w-6 text-center text-xs font-black text-zinc-500">#{{ idx + 1 }}</span>
                      @if (plat.logoUrl) {
                        <img [src]="plat.logoUrl" [alt]="plat.name" class="h-5 max-w-[4rem] object-contain invert opacity-90" />
                      }
                      <span class="font-bold text-sm text-white truncate">{{ plat.name }}</span>
                    </div>

                    <div class="flex items-center gap-3 shrink-0 text-xs">
                      <span class="px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 font-bold border border-white/10">{{ plat.count }} series</span>
                      <span class="text-blue-400 font-bold">~{{ plat.hours }}h</span>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="py-12 text-center text-zinc-500 text-sm">No network info available.</div>
            }
          </div>

          @if (topPlatforms().length > 0) {
            <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 flex items-center gap-3">
              <span class="text-xl">🍿</span>
              <p>You spend the most hours watching content from <strong class="text-blue-300">{{ topPlatforms()[0].name }}</strong>.</p>
            </div>
          }
        </div>

      </div>

      <!-- 3. Tu Actor / Creador Fetiche -->
      @if (topActor(); as actor) {
        <div class="mb-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-zinc-950 border border-amber-500/30 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div class="flex flex-col sm:flex-row items-center gap-6 relative z-10">
            <div class="relative shrink-0">
              @if (actor.profilePath) {
                <img [src]="actor.profilePath" [alt]="actor.name" class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shadow-2xl border-2 border-amber-400/40" />
              } @else {
                <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-amber-500/20 border-2 border-amber-400/40 flex items-center justify-center text-3xl">🎭</div>
              }
              <div class="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black shadow">★ VIP</div>
            </div>

            <div class="flex-1 text-center sm:text-left min-w-0">
              <span class="text-[11px] font-black uppercase tracking-wider text-amber-400">Actor Fetiche</span>
              <h3 class="text-2xl sm:text-3xl font-black text-white mt-0.5 truncate">{{ actor.name }}</h3>
              <p class="text-zinc-300 text-xs sm:text-sm mt-1">
                You've watched <strong class="text-amber-300 font-bold">{{ actor.count }} series</strong> starring {{ actor.name }}:
              </p>
              <div class="flex flex-wrap gap-1.5 mt-2.5 justify-center sm:justify-start">
                @for (showTitle of actor.shows; track showTitle) {
                  <span class="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold">{{ showTitle }}</span>
                }
              </div>
            </div>

            <button 
              (click)="openPersonModal(actor.id)"
              class="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs sm:text-sm transition-all shadow-lg active:scale-95 shrink-0 flex items-center gap-1.5">
              <span>View Filmography</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>
      }

      <!-- 4. Insignias y Logros -->
      <div class="mb-10 p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg shadow-sm">🏆</div>
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-white">Achievements & Badges</h2>
              <p class="text-xs text-zinc-400">Unlock special badges by watching series</p>
            </div>
          </div>
          <div class="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-emerald-400">
            {{ unlockedBadgesCount() }} / {{ badges().length }} Unlocked
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (b of badges(); track b.id) {
            <div 
              class="p-4 rounded-2xl border transition-all relative flex flex-col justify-between"
              [class]="b.unlocked ? 'bg-black/50 border-emerald-500/30 shadow-lg' : 'bg-black/20 border-white/5 opacity-65'">
              @if (b.unlocked) {
                <div class="absolute top-2 right-2 text-emerald-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
              }
              <div>
                <div class="text-3xl mb-2">{{ b.icon }}</div>
                <h4 class="font-extrabold text-sm text-white">{{ b.name }}</h4>
                <p class="text-zinc-400 text-xs mt-1 leading-snug">{{ b.desc }}</p>
              </div>

              <div class="mt-4 pt-3 border-t border-white/5">
                <div class="flex items-center justify-between text-[11px] mb-1">
                  <span [class]="b.unlocked ? 'text-emerald-400 font-bold' : 'text-zinc-500'">{{ b.unlocked ? 'Unlocked' : 'In Progress' }}</span>
                  <span class="text-zinc-400 font-semibold">{{ b.progressText }}</span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500" [style.width.%]="b.progressPercent" [class]="b.unlocked ? 'bg-emerald-400' : 'bg-zinc-600'"></div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- 5. Hall of Fame -->
      @if (topRatedShows().length > 0) {
        <div class="mb-10 p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg shadow-sm">⭐</div>
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-white">Your Hall of Fame</h2>
              <p class="text-xs text-zinc-400">Your highest-rated series</p>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            @for (w of topRatedShows(); track w.instanceId) {
              <div class="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/40 transition-all cursor-pointer bg-zinc-950"
                   (click)="state.openDetails(w.show)">
                <div class="aspect-[2/3] w-full overflow-hidden">
                  <img [src]="w.show.poster_path" [alt]="w.show.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-black text-amber-400 border border-amber-400/30 flex items-center gap-1">
                  <span>★</span><span>{{ w.userRating }}/10</span>
                </div>
                <div class="p-2.5 bg-gradient-to-t from-black via-black/90 to-transparent">
                  <h4 class="font-bold text-xs text-white truncate">{{ w.show.name }}</h4>
                  <p class="text-[10px] text-zinc-400">{{ w.seasonsWatched }}/{{ w.show.number_of_seasons }} seasons</p>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- SOCIAL STORY CARD MODAL -->
      @if (showStoryModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div class="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/20 p-5 shadow-2xl flex flex-col max-h-[90vh]">
            <button (click)="showStoryModal.set(false)" class="absolute top-4 right-4 text-zinc-400 hover:text-white p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <h3 class="text-base font-bold text-white mb-3 text-center">Share Your TV Wrapped</h3>

            <!-- Card Preview (9:16) -->
            <div #storyCardContainer class="relative aspect-[9/16] w-full rounded-2xl overflow-hidden p-6 bg-gradient-to-b from-violet-950 via-slate-950 to-black border border-white/20 shadow-2xl flex flex-col justify-between text-center select-none">
              <div>
                <span class="text-[10px] font-black uppercase tracking-widest text-fuchsia-400">BINGETIME WRAPPED</span>
                <h4 class="text-2xl font-black text-white tracking-tight mt-1">My Watch Journey</h4>
              </div>

              <div class="py-2">
                <div class="text-4xl font-black text-white tabular-nums tracking-tighter">
                  {{ state.days() }}d {{ state.hours() }}h {{ state.minutes() }}m
                </div>
                <p class="text-xs text-zinc-400 mt-1">Total time spent watching series</p>

                <div class="flex items-center justify-center gap-3 mt-4 text-xs">
                  <span class="px-2.5 py-1 rounded-full bg-white/10 text-white font-bold border border-white/10">{{ state.totalEpisodes() }} Episodes</span>
                  <span class="px-2.5 py-1 rounded-full bg-white/10 text-white font-bold border border-white/10">{{ state.watchedShows().length }} Series</span>
                </div>
              </div>

              <div>
                <p class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Favorite Series</p>
                <div class="flex justify-center gap-2">
                  @for (show of topStoryShows(); track show.id) {
                    <img [src]="show.poster_path" [alt]="show.name" class="w-16 h-24 object-cover rounded-xl shadow-lg border border-white/15" />
                  }
                </div>
              </div>

              <div class="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400">
                <span class="font-black text-white tracking-wider">BingeTime.app</span>
                @if (topGenres().length > 0) {
                  <span class="text-fuchsia-300 font-bold">Top: {{ topGenres()[0].name }}</span>
                }
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2.5 mt-4">
              <button 
                (click)="downloadStoryPng()" 
                [disabled]="isGeneratingPng()"
                class="flex-1 py-2.5 px-3 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow">
                @if (isGeneratingPng()) {
                  <svg class="animate-spin w-4 h-4 text-black" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  <span>Generating PNG...</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  <span>Download Image</span>
                }
              </button>

              <button 
                (click)="copySummaryText()"
                class="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs transition-all active:scale-95">
                {{ isCopied() ? '✓ Copied' : 'Copy Text' }}
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class StatsWrappedComponent {
  state = inject(ShowStateService);
  tmdb = inject(TmdbService);

  showStoryModal = signal<boolean>(false);
  isGeneratingPng = signal<boolean>(false);
  isCopied = signal<boolean>(false);

  @ViewChild('storyCardContainer') storyCardRef?: ElementRef<HTMLDivElement>;

  averageUserRating = computed(() => {
    const rated = this.state.watchedShows().filter(w => w.userRating > 0);
    return rated.length ? rated.reduce((a, c) => a + c.userRating, 0) / rated.length : 0;
  });

  rewatchCount = computed(() => {
    const shows = this.state.watchedShows();
    return Math.max(0, shows.length - new Set(shows.map(w => w.show.id)).size);
  });

  topGenres = computed<GenreStat[]>(() => {
    const shows = this.state.watchedShows();
    if (!shows.length) return [];
    const counts = new Map<string, number>();
    shows.forEach(w => (w.show.genres || []).forEach(g => counts.set(g, (counts.get(g) || 0) + 1)));
    const colors = ['#d946ef', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(counts.entries())
      .map(([name, count], i) => ({ name, count, percentage: Math.round((count / total) * 100), color: colors[i % colors.length] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  });

  topPlatforms = computed<PlatformStat[]>(() => {
    const shows = this.state.watchedShows();
    if (!shows.length) return [];
    const map = new Map<string, { count: number; logoUrl?: string; minutes: number }>();
    shows.forEach(w => (w.show.networks || []).forEach(net => {
      const e = map.get(net.name) || { count: 0, logoUrl: net.logo_path || undefined, minutes: 0 };
      e.count++; e.minutes += (w.totalMinutes || 0);
      if (!e.logoUrl && net.logo_path) e.logoUrl = net.logo_path;
      map.set(net.name, e);
    }));
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, count: d.count, logoUrl: d.logoUrl, hours: Math.round(d.minutes / 60) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  topActor = computed<ActorStat | null>(() => {
    const shows = this.state.watchedShows();
    if (!shows.length) return null;
    const map = new Map<number, { name: string; profilePath?: string; shows: Set<string> }>();
    shows.forEach(w => (w.show.cast || []).forEach(c => {
      if (!map.has(c.id)) {
        map.set(c.id, {
          name: c.name,
          profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
          shows: new Set()
        });
      }
      map.get(c.id)!.shows.add(w.show.name);
    }));

    let best: ActorStat | null = null;
    let max = 1;
    for (const [id, d] of map.entries()) {
      if (d.shows.size > max) {
        max = d.shows.size;
        best = { id, name: d.name, profilePath: d.profilePath, count: d.shows.size, shows: Array.from(d.shows).slice(0, 5) };
      }
    }
    return best;
  });

  badges = computed<Badge[]>(() => {
    const shows = this.state.watchedShows();
    const hours = Math.floor(this.state.totalMinutes() / 60);
    const ratedCount = shows.filter(w => w.userRating > 0).length;
    const tensCount = shows.filter(w => w.userRating === 10).length;
    const rewatches = this.rewatchCount();

    // New metrics
    const genres = new Set(shows.flatMap(w => w.show.genres || []));
    const platforms = new Set(shows.flatMap(w => (w.show.networks || []).map(n => n.name)));
    const longShows = shows.filter(w => (w.seasonsWatched || 0) >= 4).length;

    const totalEps = this.state.totalEpisodes();

    const list: [string, string, string, string, boolean, string, number, string][] = [
      ['marathon', 'Maratoniano Legendario', 'Over 2 months of your life watching series', '🏃', hours >= 1440, `${Math.min(1440, hours)} / 1.440h (60d)`, Math.min(100, (hours / 1440) * 100), '#10b981'],
      ['binge_god', 'Binge God', 'Log at least 50 different series', '👑', shows.length >= 50, `${Math.min(50, shows.length)} / 50`, Math.min(100, (shows.length / 50) * 100), '#f59e0b'],
      ['binge_obsession', 'Binge Obsession', 'Re-watch at least 3 different series', '🔁', rewatches >= 3, `${Math.min(3, rewatches)} / 3`, Math.min(100, (rewatches / 3) * 100), '#3b82f6'],
      ['elite_critic', 'Elite Critic', 'Review and score at least 25 shows', '⭐', ratedCount >= 25, `${Math.min(25, ratedCount)} / 25`, Math.min(100, (ratedCount / 25) * 100), '#ec4899'],
      ['episode_behemoth', 'Máquina de Episodios', 'Watch over 1,000 total episodes', '🍿', totalEps >= 1000, `${Math.min(1000, totalEps)} / 1.000 eps`, Math.min(100, (totalEps / 1000) * 100), '#8b5cf6'],
      ['platform_hoarder', 'El Gran Coleccionista', 'Shows from 10+ streaming platforms', '📡', platforms.size >= 10, `${Math.min(10, platforms.size)} / 10 platforms`, Math.min(100, (platforms.size / 10) * 100), '#06b6d4'],
      ['season_conqueror', 'Devorador de Sagas', 'Watch 5+ series with 4 or more seasons', '📜', longShows >= 5, `${Math.min(5, longShows)} / 5 series (4+ temp)`, Math.min(100, (longShows / 5) * 100), '#d946ef'],
      ['master_of_tens', 'Ojo Infalible', 'Award a 10/10 to 5+ masterpieces', '💎', tensCount >= 5, `${Math.min(5, tensCount)} / 5 rated 10★`, Math.min(100, (tensCount / 5) * 100), '#eab308']
    ];

    return list.map(([id, name, desc, icon, unlocked, progressText, progressPercent, color]) => ({
      id, name, desc, icon, unlocked, progressText, progressPercent, color
    }));
  });

  unlockedBadgesCount = computed(() => this.badges().filter(b => b.unlocked).length);

  topRatedShows = computed(() => this.state.watchedShows().filter(w => w.userRating > 0).sort((a, b) => b.userRating - a.userRating).slice(0, 5));

  topStoryShows = computed(() => {
    const rated = this.topRatedShows().map(w => w.show);
    return (rated.length >= 3 ? rated : this.state.watchedShows().map(w => w.show)).slice(0, 3);
  });

  openPersonModal(id: number) { this.tmdb.openPersonModal(id); }

  downloadStoryPng() {
    this.isGeneratingPng.set(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const grad = ctx.createLinearGradient(0, 0, 0, 1920);
      grad.addColorStop(0, '#090414'); grad.addColorStop(0.5, '#0b0f19'); grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1920);

      ctx.textAlign = 'center';
      ctx.font = 'bold 36px sans-serif'; ctx.fillStyle = '#e879f9'; ctx.fillText('BINGETIME WRAPPED', 540, 220);
      ctx.font = '900 84px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('My TV Journey', 540, 320);

      this.roundRect(ctx, 140, 420, 800, 400, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; ctx.stroke();

      ctx.font = '900 110px sans-serif'; ctx.fillStyle = '#ffffff';
      ctx.fillText(`${this.state.days()}d ${this.state.hours()}h ${this.state.minutes()}m`, 540, 580);
      ctx.font = '600 36px sans-serif'; ctx.fillStyle = '#a1a1aa';
      ctx.fillText('Total time spent binging series', 540, 660);
      ctx.font = 'bold 42px sans-serif'; ctx.fillStyle = '#34d399';
      ctx.fillText(`🍿 ${this.state.totalEpisodes()} Episodes  •  📺 ${this.state.watchedShows().length} Series`, 540, 750);

      ctx.font = 'bold 34px sans-serif'; ctx.fillStyle = '#94a3b8';
      ctx.fillText('FAVORITE SERIES', 540, 1140);

      const topShows = this.topStoryShows();
      const startX = 540 - ((topShows.length * 240 + (topShows.length - 1) * 30) / 2);
      const promises = topShows.map((show, idx) => new Promise<void>(resolve => {
        const x = startX + idx * 270, y = 1180, w = 240, h = 360;
        if (show.poster_path) {
          const img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save(); this.roundRect(ctx, x, y, w, h, 20); ctx.clip();
            ctx.drawImage(img, x, y, w, h); ctx.restore();
            resolve();
          };
          img.onerror = () => { this.drawFallback(ctx, x, y, w, h, show.name); resolve(); };
          img.src = show.poster_path;
        } else {
          this.drawFallback(ctx, x, y, w, h, show.name); resolve();
        }
      }));

      Promise.all(promises).finally(() => {
        ctx.font = 'bold 36px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('BingeTime.app', 540, 1780);
        const link = document.createElement('a');
        link.download = `BingeTime_Wrapped.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.isGeneratingPng.set(false);
      });
    } catch {
      this.isGeneratingPng.set(false);
    }
  }

  private drawFallback(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: string) {
    this.roundRect(ctx, x, y, w, h, 20); ctx.fillStyle = '#1e1b4b'; ctx.fill();
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(t.slice(0, 12), x + w/2, y + h/2);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    ctx.closePath();
  }

  copySummaryText() {
    const text = `🍿 Mi BingeTime Wrapped:\n⏱️ ${this.state.days()}d ${this.state.hours()}h viendo series!\n📺 ${this.state.watchedShows().length} series y ${this.state.totalEpisodes()} capítulos.\n🏆 ${this.unlockedBadgesCount()} logros desbloqueados en BingeTime.app`;
    navigator.clipboard.writeText(text).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    });
  }
}
