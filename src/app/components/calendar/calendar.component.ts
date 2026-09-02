import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TVShow } from '../../models';
import { ShowStateService } from '../../services/show-state.service';
import { TmdbService } from '../../services/tmdb.service';

export interface CalendarEpisodeEvent {
  show: TVShow;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  airDate: string; // YYYY-MM-DD
  overview?: string;
  stillPath?: string | null;
  runtime?: number | null;
  voteAverage?: number | null;
  isWatched: boolean;
  isPending: boolean;
  isPopularRelease?: boolean;
}

export interface CalendarDayCell {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEpisodeEvent[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-fade-in relative z-10 pb-20 w-full max-w-[1600px] mx-auto">
      
      <!-- Top Header & Navigation Bar -->
      <div class="mb-6 border-b border-white/10 pb-6">
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          
          <!-- Title & Back link -->
          <div class="flex items-center gap-3.5">
            <a routerLink="/" class="p-2.5 sm:p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all border border-white/10 shadow-md shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <div>
              <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                <span>📅 TV Schedule Calendar</span>
              </h2>
              <p class="text-zinc-400 text-xs sm:text-sm mt-0.5">Air dates and scheduled broadcasts for your series and top TV releases</p>
            </div>
          </div>

          <!-- Top Controls Bar -->
          <div class="flex flex-wrap items-center gap-3">
            
            <!-- Source Toggle Mode (My Shows vs Top Popular) -->
            <div class="flex items-center bg-zinc-900/90 p-1 rounded-2xl border border-white/15 shadow-xl">
              <button 
                (click)="calendarMode.set('my-shows')"
                [class]="calendarMode() === 'my-shows' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30' : 'text-zinc-400 hover:text-white'"
                class="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span>My Shows</span>
              </button>
              
              <button 
                (click)="calendarMode.set('popular')"
                [class]="calendarMode() === 'popular' ? 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/30' : 'text-zinc-400 hover:text-white'"
                class="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path></svg>
                <span>Top Popular</span>
              </button>
            </div>

            <!-- View Style Switcher (Month / Week / Agenda List) -->
            <div class="flex items-center bg-zinc-900/90 p-1 rounded-2xl border border-white/15 shadow-xl">
              <button 
                (click)="viewType.set('month')"
                [class]="viewType() === 'month' ? 'bg-white/20 text-white font-bold' : 'text-zinc-400 hover:text-white'"
                class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all"
                title="Month Grid View">
                Month
              </button>
              <button 
                (click)="viewType.set('week')"
                [class]="viewType() === 'week' ? 'bg-white/20 text-white font-bold' : 'text-zinc-400 hover:text-white'"
                class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all"
                title="7-Day Week View">
                Week
              </button>
              <button 
                (click)="viewType.set('agenda')"
                [class]="viewType() === 'agenda' ? 'bg-white/20 text-white font-bold' : 'text-zinc-400 hover:text-white'"
                class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all"
                title="Agenda List View">
                Agenda
              </button>
            </div>

            <!-- Month / Period Switcher -->
            <div class="flex items-center bg-zinc-900/90 rounded-2xl border border-white/15 p-1 shadow-xl">
              <button 
                (click)="prevPeriod()" 
                class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                title="Previous">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
              </button>
              <button 
                (click)="goToToday()"
                class="px-3 py-1.5 rounded-xl hover:bg-white/10 text-xs sm:text-sm font-extrabold text-white tracking-wide min-w-[120px] sm:min-w-[150px] text-center transition-colors">
                @if (viewType() === 'week') {
                  Week of {{ currentWeekLabel() }}
                } @else {
                  {{ currentMonthName() }} {{ currentYear() }}
                }
              </button>
              <button 
                (click)="nextPeriod()" 
                class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                title="Next">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
              </button>
            </div>

          </div>

        </div>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="flex flex-col items-center justify-center py-32">
          <svg class="animate-spin h-12 w-12 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-zinc-300 text-sm font-bold">Loading broadcasts for {{ currentMonthName() }} {{ currentYear() }}...</p>
        </div>
      } @else {

        <!-- 1. MONTH VIEW (Responsive Table with overflow prevention) -->
        @if (viewType() === 'month') {
          <div class="glass-strong rounded-3xl border border-white/15 overflow-hidden shadow-2xl">
            
            <!-- Horizontal scroll container on mobile/tablet so columns never compress -->
            <div class="overflow-x-auto custom-scrollbar">
              <div class="min-w-[1050px] xl:min-w-full">
                
                <!-- Weekday Headers -->
                <div class="grid grid-cols-7 border-b border-white/10 bg-zinc-950/95 text-center text-xs sm:text-sm font-black text-zinc-400 py-3.5 uppercase tracking-wider">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span class="text-amber-400/90">Sat</span>
                  <span class="text-amber-400/90">Sun</span>
                </div>

                <!-- Month Grid Cells -->
                <div class="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-white/10 bg-black/40">
                  @for (day of calendarDays(); track day.dateKey) {
                    <div 
                      (click)="selectDay(day, true)"
                      [class]="'min-h-[120px] sm:min-h-[140px] md:min-h-[150px] p-1.5 sm:p-2 transition-all flex flex-col cursor-pointer group relative ' + 
                               (!day.isCurrentMonth ? 'opacity-25 bg-black/60' : 'hover:bg-white/[0.05]') + ' ' + 
                               (day.isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-500/[0.12]' : '') + ' ' +
                               (day.isToday ? 'bg-amber-400/[0.06]' : '')">
                      
                      <!-- Header: Day Number + Count badge -->
                      <div class="flex items-center justify-between mb-1.5">
                        <span 
                          [class]="day.isToday 
                            ? 'w-6 h-6 rounded-full bg-amber-400 text-black font-black flex items-center justify-center text-[11px] shadow-md shadow-amber-400/30' 
                            : (day.isSelected ? 'w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-[11px] shadow' : 'text-xs font-bold text-zinc-400 group-hover:text-white')">
                          {{ day.dayNumber }}
                        </span>

                        @if (day.events.length > 0) {
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                [class]="calendarMode() === 'popular' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'">
                            {{ day.events.length }}
                          </span>
                        }
                      </div>

                      <!-- Show cards inside cell - BIG posters with name and episode tag -->
                      <div class="flex-1 space-y-1.5 overflow-hidden flex flex-col justify-start">
                        @for (ev of day.events.slice(0, 3); track ev.show.id + '-' + ev.seasonNumber + '-' + ev.episodeNumber) {
                          <div 
                            (click)="state.openDetails(ev.show); $event.stopPropagation()"
                            class="p-1.5 rounded-xl bg-zinc-900/95 hover:bg-zinc-800/95 border border-white/10 hover:border-amber-400/40 text-xs text-white transition-all flex items-center gap-2 shadow-sm group/chip"
                            title="{{ ev.show.name }} - S{{ ev.seasonNumber }}E{{ ev.episodeNumber }}: {{ ev.episodeName }}">
                            
                            <!-- Big Poster -->
                            @if (ev.show.poster_path) {
                              <img [src]="ev.show.poster_path" [alt]="ev.show.name" class="w-8 h-12 rounded-lg object-cover shrink-0 shadow group-hover/chip:scale-105 transition-transform" />
                            } @else {
                              <div class="w-8 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-500 shrink-0">TV</div>
                            }
                            
                            <div class="flex-1 min-w-0">
                              <p class="truncate font-extrabold text-[11px] sm:text-xs leading-snug text-white group-hover/chip:text-amber-400 transition-colors">
                                {{ ev.show.name }}
                              </p>
                              <div class="flex items-center gap-1 mt-0.5">
                                <span class="text-[9px] sm:text-[10px] font-mono text-blue-400 font-bold">
                                  S{{ ev.seasonNumber }}E{{ ev.episodeNumber }}
                                </span>
                                @if (ev.voteAverage) {
                                  <span class="text-[9px] sm:text-[10px] text-amber-400 font-bold">★ {{ ev.voteAverage }}</span>
                                }
                              </div>
                            </div>

                          </div>
                        }

                        @if (day.events.length > 3) {
                          <button 
                            (click)="selectDay(day, true); $event.stopPropagation()"
                            class="w-full text-[10px] font-black text-blue-300 hover:text-white bg-blue-600/25 hover:bg-blue-600/60 active:scale-95 px-2 py-1 rounded-lg text-center border border-blue-500/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            title="View all {{ day.events.length }} episodes">
                            <span>+{{ day.events.length - 3 }} more</span>
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                          </button>
                        }
                      </div>

                    </div>
                  }
                </div>

              </div>
            </div>

          </div>
        }

        <!-- 2. WEEK VIEW (Spacious 7 Columns with Full Cards) -->
        @if (viewType() === 'week') {
          <div class="glass-strong rounded-3xl border border-white/15 p-4 sm:p-6 shadow-2xl">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              @for (day of currentWeekDays(); track day.dateKey) {
                <div 
                  (click)="selectDay(day, true)"
                  [class]="'rounded-2xl p-3 sm:p-4 border transition-all flex flex-col justify-between cursor-pointer ' + 
                           (day.isToday ? 'bg-amber-400/[0.08] border-amber-400/40 shadow-lg' : 'bg-zinc-950/60 border-white/10 hover:border-white/20') + ' ' + 
                           (day.isSelected ? 'ring-2 ring-blue-500' : '')">
                  
                  <!-- Day Header -->
                  <div class="border-b border-white/10 pb-2 mb-3 flex items-center justify-between">
                    <div>
                      <p class="text-[11px] font-black uppercase text-zinc-400">{{ formatWeekday(day.date) }}</p>
                      <h4 class="text-lg font-black text-white">{{ day.date.getDate() }} {{ formatMonthShort(day.date) }}</h4>
                    </div>
                    @if (day.isToday) {
                      <span class="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase">Today</span>
                    }
                  </div>

                  <!-- Events for this day -->
                  <div class="space-y-2 flex-1 min-h-[140px]">
                    @if (day.events.length === 0) {
                      <p class="text-zinc-600 text-xs italic py-4 text-center">No releases</p>
                    } @else {
                      @for (ev of day.events; track ev.show.id + '-' + ev.seasonNumber + '-' + ev.episodeNumber) {
                        <div 
                          (click)="state.openDetails(ev.show); $event.stopPropagation()"
                          class="p-2.5 rounded-2xl bg-zinc-900/90 border border-white/10 hover:border-amber-400/40 transition-all flex gap-2.5 items-center group shadow-md cursor-pointer">
                          @if (ev.show.poster_path) {
                            <img [src]="ev.show.poster_path" [alt]="ev.show.name" class="w-10 h-14 rounded-xl object-cover shrink-0 shadow group-hover:scale-105 transition-transform" />
                          }
                          <div class="flex-1 min-w-0">
                            <p class="text-white text-xs sm:text-sm font-extrabold truncate group-hover:text-amber-400 transition-colors">{{ ev.show.name }}</p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                              <span class="text-[10px] font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">S{{ ev.seasonNumber }}E{{ ev.episodeNumber }}</span>
                              @if (ev.voteAverage) {
                                <span class="text-[10px] text-amber-400 font-bold">★ {{ ev.voteAverage }}</span>
                              }
                            </div>
                          </div>
                        </div>
                      }
                    }
                  </div>

                </div>
              }
            </div>
          </div>
        }

        <!-- 3. AGENDA / LIST VIEW (Clean Mobile & Desktop Timeline) -->
        @if (viewType() === 'agenda') {
          <div class="space-y-4">
            @if (agendaGroups().length === 0) {
              <div class="text-center py-16 glass rounded-2xl border border-white/10 p-8">
                <p class="text-zinc-400 text-sm font-semibold">No episodes scheduled for this month.</p>
              </div>
            } @else {
              @for (group of agendaGroups(); track group.dateKey) {
                <div class="glass-strong rounded-2xl border border-white/10 p-4 sm:p-5 shadow-xl">
                  
                  <!-- Group Date Header -->
                  <div class="flex items-center gap-3 mb-3 border-b border-white/10 pb-2">
                    <div class="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
                         [class]="group.isToday ? 'bg-amber-400 text-black border border-amber-300' : 'bg-white/10 text-zinc-300 border border-white/10'">
                      <span>{{ group.formattedDate }}</span>
                    </div>
                    <span class="text-xs text-zinc-500 font-semibold">{{ group.events.length }} episode{{ group.events.length !== 1 ? 's' : '' }}</span>
                  </div>

                  <!-- Cards Grid -->
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    @for (ev of group.events; track ev.show.id + '-' + ev.seasonNumber + '-' + ev.episodeNumber) {
                      <div class="p-3 bg-zinc-950/80 rounded-xl border border-white/10 hover:border-white/20 flex gap-3 items-center group cursor-pointer"
                           (click)="state.openDetails(ev.show)">
                        @if (ev.show.poster_path) {
                          <img [src]="ev.show.poster_path" [alt]="ev.show.name" class="w-12 h-16 rounded-lg object-cover shrink-0" />
                        }
                        <div class="flex-1 min-w-0">
                          <h5 class="text-white text-sm font-bold truncate group-hover:text-amber-400">{{ ev.show.name }}</h5>
                          <span class="text-xs text-blue-400 font-mono font-bold">S{{ ev.seasonNumber }}E{{ ev.episodeNumber }} - {{ ev.episodeName }}</span>
                          @if (ev.voteAverage) {
                            <p class="text-amber-400 text-[11px] font-bold mt-0.5">★ {{ ev.voteAverage }}</p>
                          }
                        </div>
                      </div>
                    }
                  </div>

                </div>
              }
            }
          </div>
        }

        <!-- Selected Day Inspector Panel (Spacious view for active date) -->
        @if (selectedDay(); as day) {
          <div id="day-inspector" class="mt-8 p-6 sm:p-8 glass-strong rounded-3xl border border-white/15 shadow-2xl animate-fade-in scroll-mt-24">
            
            <!-- Day Inspector Header with Quick Day Navigator -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-5">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xl font-bold shrink-0">
                  📅
                </div>
                <div>
                  <h3 class="text-2xl font-black text-white">
                    {{ formatFullDate(day.date) }}
                  </h3>
                  <p class="text-zinc-400 text-xs sm:text-sm mt-0.5 font-medium">
                    {{ day.events.length }} release{{ day.events.length !== 1 ? 's' : '' }} on this date
                    @if (calendarMode() === 'popular') { (Top Popular TMDB Releases) }
                    @else { (From Your Watchlist) }
                  </p>
                </div>
              </div>

              <!-- Day switcher arrows + Today Badge -->
              <div class="flex items-center gap-2 self-start sm:self-auto">
                <button (click)="shiftSelectedDay(-1)" class="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
                  <span>Prev Day</span>
                </button>
                <button (click)="shiftSelectedDay(1)" class="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1">
                  <span>Next Day</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
                @if (day.isToday) {
                  <span class="px-3 py-1.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase tracking-wider shadow">
                    🔥 Today
                  </span>
                }
              </div>
            </div>

            <!-- Detailed Cards List for Selected Day -->
            @if (day.events.length === 0) {
              <div class="text-center py-8 bg-white/[0.02] rounded-2xl border border-white/5">
                <p class="text-zinc-400 text-sm font-medium">
                  No scheduled releases found for {{ formatFullDate(day.date) }}.
                </p>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                @for (ev of day.events; track ev.show.id + '-' + ev.seasonNumber + '-' + ev.episodeNumber) {
                  <div class="p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-white/10 hover:border-white/20 transition-all flex gap-4 items-start group shadow-xl">
                    
                    <!-- Large Poster Thumbnail -->
                    <div class="relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-lg cursor-pointer"
                         (click)="state.openDetails(ev.show)">
                      @if (ev.show.poster_path) {
                        <img [src]="ev.show.poster_path" [alt]="ev.show.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      }
                      
                      @if (ev.isWatched) {
                        <div class="absolute top-1.5 left-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow" title="In Watchlist">✓</div>
                      } @else if (ev.isPending) {
                        <div class="absolute top-1.5 left-1.5 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow" title="In Pending">P</div>
                      }
                    </div>

                    <!-- Details Column -->
                    <div class="flex-1 min-w-0 flex flex-col justify-between h-full">
                      <div>
                        <h4 class="text-white text-base font-extrabold truncate group-hover:text-amber-400 cursor-pointer transition-colors"
                            (click)="state.openDetails(ev.show)">
                          {{ ev.show.name }}
                        </h4>

                        <div class="mt-1 flex items-center gap-2">
                          <span class="px-2 py-0.5 rounded-md bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-mono font-bold">
                            S{{ ev.seasonNumber }}E{{ ev.episodeNumber }}
                          </span>
                          @if (ev.voteAverage) {
                            <span class="text-amber-400 text-xs font-bold flex items-center gap-0.5">
                              ★ {{ ev.voteAverage }}
                            </span>
                          }
                        </div>

                        <p class="text-white text-xs font-bold mt-1.5 truncate">
                          "{{ ev.episodeName }}"
                        </p>

                        @if (ev.overview) {
                          <p class="text-zinc-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                            {{ ev.overview }}
                          </p>
                        }
                      </div>

                      <!-- Action Buttons -->
                      <div class="mt-3 pt-2 border-t border-white/5 flex items-center gap-2">
                        <button 
                          (click)="state.openDetails(ev.show)"
                          class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all">
                          Details
                        </button>
                        
                        @if (!ev.isWatched && !ev.isPending) {
                          <button 
                            (click)="state.addToPending(ev.show)"
                            class="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow">
                            + Pending
                          </button>
                        }
                      </div>

                    </div>

                  </div>
                }
              </div>
            }
          </div>
        }

      }

    </div>
  `
})
export class CalendarComponent implements OnInit {
  state = inject(ShowStateService);
  tmdb = inject(TmdbService);

  calendarMode = signal<'my-shows' | 'popular'>('my-shows');
  viewType = signal<'month' | 'week' | 'agenda'>('month');
  currentDate = signal<Date>(new Date());
  selectedDay = signal<CalendarDayCell | null>(null);
  allEvents = signal<CalendarEpisodeEvent[]>([]);
  loading = signal<boolean>(true);

  currentMonthName = computed(() => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[this.currentDate().getMonth()];
  });

  currentYear = computed(() => this.currentDate().getFullYear());

  currentWeekLabel = computed(() => {
    const d = this.currentDate();
    return `${d.getDate()} ${this.currentMonthName().slice(0, 3)}`;
  });

  constructor() {
    effect(() => {
      this.currentDate();
      this.calendarMode();
      this.loadSchedule();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Initial load handled by effect
  }

  loadSchedule(): void {
    this.loading.set(true);
    const mode = this.calendarMode();

    if (mode === 'my-shows') {
      this.loadUserShowsSchedule();
    } else {
      this.loadPopularShowsSchedule();
    }
  }

  private loadUserShowsSchedule(): void {
    const watched = this.state.watchedShows();
    const pending = this.state.pendingShows();

    const showMap = new Map<number, TVShow>();
    watched.forEach(w => showMap.set(w.show.id, w.show));
    pending.forEach(p => showMap.set(p.show.id, p.show));

    const showIds = Array.from(showMap.keys());
    if (showIds.length === 0) {
      this.allEvents.set([]);
      this.loading.set(false);
      return;
    }

    const requests: Observable<CalendarEpisodeEvent[]>[] = showIds.map(id => {
      const show = showMap.get(id)!;
      return this.tmdb.getRecentEpisodes(id, 365).pipe(
        map(eps => eps.map(ep => ({
          show,
          seasonNumber: ep.season,
          episodeNumber: ep.number,
          episodeName: ep.name,
          airDate: ep.airdate,
          overview: ep.overview,
          isWatched: this.state.isWatched(show.id),
          isPending: this.state.isInPending(show.id),
          voteAverage: show.rating
        }))),
        catchError(() => of([]))
      );
    });

    const latestSeasonRequests: Observable<CalendarEpisodeEvent[]>[] = showIds.map(id => {
      const show = showMap.get(id)!;
      const numSeasons = show.number_of_seasons || 1;
      return this.tmdb.getSeasonDetails(id, numSeasons).pipe(
        map(season => {
          if (!season || !season.episodes) return [];
          return season.episodes
            .filter(ep => ep.air_date != null && ep.air_date !== '')
            .map(ep => ({
              show,
              seasonNumber: ep.season_number,
              episodeNumber: ep.episode_number,
              episodeName: ep.name,
              airDate: ep.air_date!,
              overview: ep.overview,
              stillPath: ep.still_path,
              runtime: ep.runtime,
              voteAverage: ep.vote_average || show.rating,
              isWatched: this.state.isWatched(show.id),
              isPending: this.state.isInPending(show.id)
            }));
        }),
        catchError(() => of([]))
      );
    });

    forkJoin([...requests, ...latestSeasonRequests]).subscribe({
      next: results => {
        this.processEvents(results.flat());
      },
      error: () => this.loading.set(false)
    });
  }

  private loadPopularShowsSchedule(): void {
    const curr = this.currentDate();
    const y = curr.getFullYear();
    const m = curr.getMonth();

    const start = new Date(y, m, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);

    forkJoin({
      discover: this.tmdb.getTopUpcomingPopularShows(start, end),
      onAir: this.tmdb.getOnTheAirShows(1),
      airingToday: this.tmdb.getAiringTodayShows(1)
    }).subscribe({
      next: res => {
        const showMap = new Map<number, TVShow>();
        [...res.discover, ...res.onAir.shows, ...res.airingToday.shows].forEach(s => {
          if (s && s.id && !showMap.has(s.id)) {
            showMap.set(s.id, s);
          }
        });

        const popularShows = Array.from(showMap.values()).slice(0, 30);
        if (popularShows.length === 0) {
          this.allEvents.set([]);
          this.loading.set(false);
          return;
        }

        const epRequests: Observable<CalendarEpisodeEvent[]>[] = popularShows.map(show => {
          return this.tmdb.getRecentEpisodes(show.id, 365).pipe(
            map(eps => {
              const events: CalendarEpisodeEvent[] = eps.map(ep => ({
                show,
                seasonNumber: ep.season,
                episodeNumber: ep.number,
                episodeName: ep.name,
                airDate: ep.airdate,
                overview: ep.overview,
                isWatched: this.state.isWatched(show.id),
                isPending: this.state.isInPending(show.id),
                isPopularRelease: true,
                voteAverage: show.rating
              }));

              if (show.first_air_date && show.first_air_date >= start && show.first_air_date <= end) {
                events.push({
                  show,
                  seasonNumber: 1,
                  episodeNumber: 1,
                  episodeName: 'Series Premiere',
                  airDate: show.first_air_date,
                  overview: show.summary,
                  isWatched: this.state.isWatched(show.id),
                  isPending: this.state.isInPending(show.id),
                  isPopularRelease: true,
                  voteAverage: show.rating
                });
              }

              return events;
            }),
            catchError(() => of([]))
          );
        });

        forkJoin(epRequests).subscribe({
          next: epResults => {
            this.processEvents(epResults.flat());
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  private processEvents(events: CalendarEpisodeEvent[]): void {
    const seen = new Set<string>();
    const unique: CalendarEpisodeEvent[] = [];

    events.forEach(ev => {
      if (!ev.airDate) return;
      const key = `${ev.show.id}-${ev.seasonNumber}-${ev.episodeNumber}-${ev.airDate}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(ev);
    });

    this.allEvents.set(unique);
    this.loading.set(false);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCell = this.calendarDays().find(d => d.dateKey === todayStr);
    if (todayCell) {
      this.selectedDay.set(todayCell);
    } else if (this.calendarDays().length > 0) {
      this.selectedDay.set(this.calendarDays()[0]);
    }
  }

  calendarDays = computed<CalendarDayCell[]>(() => {
    const curr = this.currentDate();
    const year = curr.getFullYear();
    const month = curr.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: CalendarDayCell[] = [];
    const events = this.allEvents();

    const eventsByDate = new Map<string, CalendarEpisodeEvent[]>();
    events.forEach(ev => {
      const list = eventsByDate.get(ev.airDate) || [];
      list.push(ev);
      eventsByDate.set(ev.airDate, list);
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const selectedKey = this.selectedDay()?.dateKey;

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateKey = this.formatDateKey(d);
      days.push({
        date: d,
        dateKey,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        isSelected: dateKey === selectedKey,
        events: eventsByDate.get(dateKey) || []
      });
    }

    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateKey = this.formatDateKey(d);
      days.push({
        date: d,
        dateKey,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
        isSelected: dateKey === selectedKey,
        events: eventsByDate.get(dateKey) || []
      });
    }

    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      const dateKey = this.formatDateKey(d);
      days.push({
        date: d,
        dateKey,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        isSelected: dateKey === selectedKey,
        events: eventsByDate.get(dateKey) || []
      });
    }

    return days;
  });

  currentWeekDays = computed<CalendarDayCell[]>(() => {
    const curr = new Date(this.currentDate());
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;

    const monday = new Date(curr);
    monday.setDate(curr.getDate() - distanceToMonday);

    const week: CalendarDayCell[] = [];
    const events = this.allEvents();
    const eventsByDate = new Map<string, CalendarEpisodeEvent[]>();
    events.forEach(ev => {
      const list = eventsByDate.get(ev.airDate) || [];
      list.push(ev);
      eventsByDate.set(ev.airDate, list);
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const selectedKey = this.selectedDay()?.dateKey;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = this.formatDateKey(d);
      week.push({
        date: d,
        dateKey,
        dayNumber: d.getDate(),
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
        isSelected: dateKey === selectedKey,
        events: eventsByDate.get(dateKey) || []
      });
    }

    return week;
  });

  agendaGroups = computed(() => {
    const events = this.allEvents();
    const groups = new Map<string, CalendarEpisodeEvent[]>();

    events.forEach(e => {
      const list = groups.get(e.airDate) || [];
      list.push(e);
      groups.set(e.airDate, list);
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const result: { dateKey: string; formattedDate: string; isToday: boolean; events: CalendarEpisodeEvent[] }[] = [];

    Array.from(groups.keys()).sort().forEach(dateKey => {
      const d = new Date(dateKey + 'T00:00:00');
      result.push({
        dateKey,
        formattedDate: this.formatFullDate(d),
        isToday: dateKey === todayStr,
        events: groups.get(dateKey)!
      });
    });

    return result;
  });

  prevPeriod(): void {
    const d = new Date(this.currentDate());
    if (this.viewType() === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    this.currentDate.set(d);
  }

  nextPeriod(): void {
    const d = new Date(this.currentDate());
    if (this.viewType() === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    this.currentDate.set(d);
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCell = this.calendarDays().find(d => d.dateKey === todayStr);
    if (todayCell) {
      this.selectedDay.set(todayCell);
    }
  }

  selectDay(day: CalendarDayCell, scroll = false): void {
    this.selectedDay.set(day);
    if (scroll) {
      setTimeout(() => {
        const el = document.getElementById('day-inspector');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  }

  shiftSelectedDay(offset: number): void {
    const currDay = this.selectedDay()?.date || new Date();
    const newDate = new Date(currDay);
    newDate.setDate(newDate.getDate() + offset);

    const dateKey = this.formatDateKey(newDate);
    const foundCell = this.calendarDays().find(d => d.dateKey === dateKey);

    if (foundCell) {
      this.selectedDay.set(foundCell);
    } else {
      const events = this.allEvents().filter(e => e.airDate === dateKey);
      this.selectedDay.set({
        date: newDate,
        dateKey,
        dayNumber: newDate.getDate(),
        isCurrentMonth: newDate.getMonth() === this.currentDate().getMonth(),
        isToday: dateKey === new Date().toISOString().slice(0, 10),
        isSelected: true,
        events
      });
    }
  }

  private formatDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatFullDate(d: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  formatWeekday(d: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getDay()];
  }

  formatMonthShort(d: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()];
  }
}
