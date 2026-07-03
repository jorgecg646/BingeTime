import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShowStateService } from '../../services/show-state.service';
import { CounterComponent } from '../counter/counter.component';
import { YourShowsComponent } from '../your-shows/your-shows.component';
import { PendingShowsComponent } from '../pending-shows/pending-shows.component';
import { PendingShow } from '../../models';

@Component({
  selector: 'app-your-shows-page',
  standalone: true,
  imports: [RouterLink, CounterComponent, YourShowsComponent, PendingShowsComponent],
  template: `
    <div class="animate-fade-in relative z-10">

      <!-- Counter Stats -->
      <app-counter 
        [days]="state.days()" 
        [hours]="state.hours()" 
        [minutes]="state.minutes()" 
        [totalEpisodes]="state.totalEpisodes()" 
        [watchedShowsCount]="state.watchedShows().length">
      </app-counter>

      <!-- New Episodes Section (always visible when user has shows) -->
      @if (state.watchedShows().length > 0) {
        <div class="mb-8 mt-6 glass-strong rounded-2xl border overflow-hidden animate-fade-in"
             [class]="state.newEpisodeAlerts().length > 0 ? 'border-amber-500/20' : 'border-white/5'">
          <div class="flex items-center justify-between px-5 py-4" [class]="state.newEpisodeAlerts().length > 0 ? 'border-b border-white/5' : ''">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center"
                   [class]="state.newEpisodeAlerts().length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'">
                @if (state.checkingForUpdates()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                }
              </div>
              <div>
                @if (state.checkingForUpdates()) {
                  <h3 class="text-white font-bold text-sm">Checking for new episodes...</h3>
                  <p class="text-zinc-500 text-[11px]">Comparing your {{ state.watchedShows().length }} shows with TVMaze</p>
                } @else if (state.newEpisodeAlerts().length > 0) {
                  <h3 class="text-white font-bold text-xl">New Episodes in the Last Month</h3>
                  <p class="text-zinc-500 text-sm">{{ state.newEpisodeAlerts().length }} show{{ state.newEpisodeAlerts().length !== 1 ? 's' : '' }} with new episodes</p>
                } @else {
                  <h3 class="text-white font-bold text-lg">All up to date</h3>
                  <p class="text-zinc-500 text-sm">No new episodes in the last month for your shows</p>
                }
              </div>
            </div>
            <div class="flex items-center gap-3">
              @if (state.newEpisodeAlerts().length > 1) {
                <button (click)="state.dismissAllAlerts()" class="text-[10px] text-zinc-500 hover:text-zinc-300 font-semibold uppercase tracking-wider transition-colors">Dismiss all</button>
              }
              <button (click)="state.checkForNewEpisodes(true)" 
                      [disabled]="state.checkingForUpdates()"
                      class="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                      [class]="state.checkingForUpdates() ? 'bg-white/5 text-zinc-600 cursor-not-allowed' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'">
                @if (state.checkingForUpdates()) {
                  Checking...
                } @else {
                  Check now
                }
              </button>
            </div>
          </div>
          
          @if (state.newEpisodeAlerts().length > 0) {
            <div class="flex gap-4 p-5 overflow-x-auto no-scrollbar">
              @for (alert of state.newEpisodeAlerts(); track alert.showId) {
                <div class="flex-none w-80 bg-white/5 border border-white/8 rounded-2xl p-4 flex gap-4 items-start animate-slide-up hover:bg-white/10 hover:border-amber-500/20 transition-all group shadow-lg">
                  <div class="relative shrink-0 cursor-pointer" (click)="state.openDetailsById(alert.showId)">
                    <img [src]="alert.posterPath" [alt]="alert.showName" class="w-24 h-32 object-cover rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300" />
                    <div class="absolute -top-2 -right-2 min-w-[24px] h-[24px] px-1.5 bg-amber-500 rounded-full flex items-center justify-center text-black text-xs font-black animate-pulse shadow-lg border-2 border-amber-300">{{ alert.newEpisodeCount }}</div>
                  </div>
                  <div class="flex-1 min-w-0 py-1">
                    <h4 class="text-white text-base font-bold leading-snug cursor-pointer hover:text-amber-400 transition-colors line-clamp-2" (click)="state.openDetailsById(alert.showId)">{{ alert.showName }}</h4>
                    <p class="text-amber-400 text-sm font-semibold mt-2">
                      {{ alert.newEpisodeCount }} new episode{{ alert.newEpisodeCount !== 1 ? 's' : '' }}
                    </p>
                    @if (alert.newEpisodes.length > 0) {
                      <p class="text-zinc-300 text-xs mt-1 leading-snug font-medium">
                        @if (alert.newEpisodes.length === 1) {
                          S{{ alert.newEpisodes[0].season }}E{{ alert.newEpisodes[0].number }} · {{ alert.newEpisodes[0].airdate }}
                        } @else {
                          S{{ alert.newEpisodes[0].season }}E{{ alert.newEpisodes[0].number }} – S{{ alert.newEpisodes[alert.newEpisodes.length - 1].season }}E{{ alert.newEpisodes[alert.newEpisodes.length - 1].number }}
                        }
                      </p>
                      @if (alert.newEpisodes[0].name) {
                        <p class="text-zinc-500 text-xs mt-0.5 italic truncate">"{{ alert.newEpisodes[0].name }}"</p>
                      }
                    }
                    <button (click)="state.dismissAlert(alert.showId)" class="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors">Dismiss</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Pending Shows Section -->
      <app-pending-shows
        [pendingShows]="state.pendingShows()"
        (openDetails)="state.openDetails($event)"
        (removePending)="state.removePending($event)"
        (markAsWatched)="movePendingToWatched($event)">
      </app-pending-shows>

      <!-- Watchlist list -->
      @if (state.watchedShows().length > 0) {
        <app-your-shows
          [watchedShows]="state.watchedShows()"
          (openDetails)="state.openDetails($event)"
          (changeSeason)="state.changeSeason($event.item, $event.delta)"
          (removeShow)="state.removeShow($event)"
          (setUserRating)="state.setUserRating($event.item, $event.rating)">
        </app-your-shows>
      } @else {
        <div class="text-center py-16 glass rounded-2xl max-w-md mx-auto border border-white/5 p-8 mt-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-5">
            <svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-zinc-200 mb-2">No shows yet</h2>
          <p class="text-zinc-400 text-sm mb-6">Explore trending shows and start tracking your watch time</p>
          <a routerLink="/discover" class="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition-all inline-block">
            Discover Shows
          </a>
        </div>
      }
    </div>
  `
})
export class YourShowsPageComponent {
  state = inject(ShowStateService);

  /**
   * Moves a show from the pending list to the watchlist
   * by opening the season-picker modal for it.
   */
  movePendingToWatched(pending: PendingShow): void {
    this.state.addDetailsShowToWatched(pending.show);
  }
}
