import { Component, inject, signal, computed, effect, OnInit, OnDestroy, output, ChangeDetectionStrategy } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TVShow, ALL_GENRES, POPULAR_PROVIDERS, formatGenresLabel } from '../../models';
import { TmdbService } from '../../services/tmdb.service';
import { ShowStateService } from '../../services/show-state.service';

/**
 * Discover page component.
 * Features a cinematic Hero Spotlight banner, multi-criteria filtering (Platform, Genre, Decade, Sort),
 * in-catalog contextual search, and full paginated catalog powered by TMDB.
 */
@Component({
  selector: 'app-trending',
  standalone: true,
  imports: [SlicePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-fade-in relative z-10 pb-16">
      
      <!-- 🌟 Cinematic Hero Spotlight Banner -->
      @if (heroShow()) {
        <div class="relative w-full rounded-3xl overflow-hidden mb-10 border border-white/10 shadow-2xl bg-slate-950 aspect-[16/9] md:aspect-[21/8] max-h-[460px] flex items-end">
          @if (heroShow()!.backdrop_path) {
            <img [src]="heroShow()!.backdrop_path" [alt]="heroShow()!.name" class="absolute inset-0 w-full h-full object-cover opacity-45 scale-105 transform hover:scale-100 transition-transform duration-700" />
          }
          <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
          
          <div class="relative z-10 p-6 md:p-10 max-w-2xl flex flex-col justify-end">
            <div class="flex items-center gap-2 mb-3">
              <span class="px-2.5 py-1 rounded-full bg-amber-400 text-black text-[11px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                🔥 #1 Spotlight
              </span>
              @if (heroShow()!.rating) {
                <span class="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[11px] font-bold flex items-center gap-1">
                  ★ {{ heroShow()!.rating }}
                </span>
              }
              <span class="text-zinc-400 text-xs font-semibold">{{ heroShow()!.first_air_date | slice:0:4 }}</span>
            </div>

            <h1 class="text-3xl md:text-5xl font-black text-white tracking-tight leading-none mb-3 drop-shadow-md">
              {{ heroShow()!.name }}
            </h1>

            <p class="text-zinc-300 text-xs md:text-sm line-clamp-2 md:line-clamp-3 mb-5 leading-relaxed drop-shadow">
              {{ heroShow()!.summary }}
            </p>

            <div class="flex flex-wrap items-center gap-3">
              <button 
                (click)="openDetails.emit(heroShow()!)" 
                class="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 active:scale-95 transition-all font-bold text-xs md:text-sm flex items-center gap-2 shadow-xl">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Show Info & Trailer
              </button>

              @if (!state.isWatched(heroShow()!.id)) {
                <button 
                  (click)="state.addDetailsShowToWatched(heroShow()!)"
                  class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white active:scale-95 transition-all font-bold text-xs md:text-sm flex items-center gap-1.5 backdrop-blur-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                  Mark watched
                </button>
              }

              @if (!state.isInPending(heroShow()!.id)) {
                <button 
                  (click)="state.addToPending(heroShow()!)"
                  class="px-4 py-2.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-200 active:scale-95 transition-all font-bold text-xs md:text-sm flex items-center gap-1.5 backdrop-blur-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Pending
                </button>
              }
            </div>
          </div>
        </div>
      }

      <!-- 🏷️ Discover Header & Filters Bar -->
      <div id="discover-catalog" class="mb-8 border-b border-white/5 pb-6 scroll-mt-24">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Discover TV Shows</span>
            </h2>
            <p class="text-zinc-400 text-xs mt-1">Explore all shows, filter by streaming platform, genres and rankings</p>
          </div>

          <!-- Sort & Dropdown Filters -->
          <div class="flex flex-wrap items-center gap-2 relative">
            
            @if (activeDropdown()) {
              <!-- Backdrop dismisser -->
              <div class="fixed inset-0 z-40 bg-transparent" (click)="activeDropdown.set(null)"></div>
            }

            <!-- Sort By Selector -->
            <div class="relative">
              <button 
                (click)="activeDropdown.set(activeDropdown() === 'sort' ? null : 'sort')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs">
                <span>SORT: {{ getSortLabel() }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'sort'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeDropdown() === 'sort') {
                <div class="absolute top-full left-0 mt-2 z-50 w-44 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-1.5">
                  @for (opt of sortOptions; track opt.value) {
                    <button (click)="setSort(opt.value)" class="w-full text-left px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-between" [class.text-blue-400]="selectedSort() === opt.value">
                      <span>{{ opt.label }}</span>
                      @if (selectedSort() === opt.value) {
                        <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                      }
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Genre Filter (Multi-select) -->
            <div class="relative">
              <button 
                (click)="activeDropdown.set(activeDropdown() === 'genre' ? null : 'genre')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs"
                [class.border-blue-500]="selectedGenres().length > 0"
                [class.text-blue-400]="selectedGenres().length > 0">
                <span>GENRES: {{ getGenreLabel() }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'genre'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeDropdown() === 'genre') {
                <div class="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 z-50 w-64 max-w-[calc(100vw-2.5rem)] bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-2.5 max-h-80 flex flex-col">
                  <div class="flex items-center justify-between pb-2 mb-1.5 border-b border-white/10 px-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Select Genres</span>
                    @if (selectedGenres().length > 0) {
                      <button (click)="clearGenres()" class="text-[10px] text-red-400 hover:text-red-300 font-bold px-1.5 py-0.5 rounded bg-red-500/10">Reset</button>
                    }
                  </div>
                  <div class="overflow-y-auto space-y-0.5 custom-scrollbar pr-1 flex-1">
                    @for (genre of allGenres; track genre) {
                      <button 
                        (click)="toggleGenre(genre)" 
                        [class]="isGenreSelected(genre) ? 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors bg-blue-600/20 text-blue-400' : 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors text-zinc-300 hover:bg-white/5'">
                        <span>{{ genre }}</span>
                        @if (isGenreSelected(genre)) {
                          <svg class="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                        }
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Decade Filter -->
            <div class="relative">
              <button 
                (click)="activeDropdown.set(activeDropdown() === 'decade' ? null : 'decade')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs">
                <span>YEAR: {{ selectedDecade() || 'ALL' }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'decade'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeDropdown() === 'decade') {
                <div class="absolute top-full left-0 mt-2 z-50 w-44 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-1.5">
                  <button (click)="setDecade(null)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-between">
                    <span>All Years</span>
                    @if (!selectedDecade()) {
                      <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                    }
                  </button>
                  @for (dec of ['2020s', '2010s', '2000s', '1990s', 'Older']; track dec) {
                    <button (click)="setDecade(dec)" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-between" [class.text-blue-400]="selectedDecade() === dec">
                      <span>{{ dec }}</span>
                      @if (selectedDecade() === dec) {
                        <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                      }
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Format / Miniseries Filter -->
            <div class="relative">
              <button 
                (click)="activeDropdown.set(activeDropdown() === 'type' ? null : 'type')"
                class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs"
                [class.border-blue-500]="selectedType() !== 'all'"
                [class.text-blue-400]="selectedType() !== 'all'">
                <span>FORMAT: {{ getTypeLabel() }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'type'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (activeDropdown() === 'type') {
                <div class="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 z-50 w-48 max-w-[calc(100vw-2.5rem)] bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-1.5">
                  <button (click)="setType('all')" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:text-white hover:bg-white/5" [class.text-blue-400]="selectedType() === 'all'" [class.text-zinc-400]="selectedType() !== 'all'">All Formats</button>
                  <button (click)="setType('miniseries')" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:text-white hover:bg-white/5 flex items-center justify-between" [class.text-blue-400]="selectedType() === 'miniseries'" [class.text-zinc-400]="selectedType() !== 'miniseries'">
                    <span>⏱️ Miniseries</span>
                    <span class="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">1 Season</span>
                  </button>
                  <button (click)="setType('series')" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:text-white hover:bg-white/5" [class.text-blue-400]="selectedType() === 'series'" [class.text-zinc-400]="selectedType() !== 'series'">📺 Standard Series</button>
                </div>
              }
            </div>

            <!-- 🌍 Country / Region Filter (Opens JustWatch-Style Modal) -->
            <button 
              (click)="tmdb.openRegionModal()"
              class="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 font-semibold text-xs shadow-sm active:scale-95">
              <img [src]="tmdb.activeCountryFlagUrl()" class="w-4 h-3 object-cover rounded-sm shadow-sm" [alt]="tmdb.activeCountry()" />
              <span>REGION: {{ tmdb.activeCountry() }}</span>
              <svg class="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            @if (selectedGenres().length > 0 || selectedDecade() || selectedProvider() || selectedType() !== 'all' || selectedSort() !== 'popularity.desc') {
              <button 
                (click)="resetFilters()"
                class="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all font-bold text-[10px] uppercase flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                Clear
              </button>
            }
          </div>
        </div>

        <!-- 📺 Streaming Platform Filter Row -->
        <div class="flex flex-wrap items-center gap-2 pt-5 pb-2">
          <span class="text-xs font-black uppercase tracking-wider text-zinc-500 shrink-0 mr-1">Platform:</span>
          @for (provider of providers; track provider.id) {
            <button
              (click)="selectProvider(provider.id)"
              [class]="selectedProvider() === provider.id 
                ? 'bg-white text-black font-bold shadow-xl shadow-white/10 scale-105 border-white' 
                : 'bg-white/5 border border-white/10 text-zinc-200 hover:text-white hover:bg-white/10'"
              class="px-3.5 py-1.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 shadow-sm border">
              @if (provider.logo) {
                <img [src]="provider.logo" alt="" class="w-5 h-5 rounded-lg object-cover shadow-sm shrink-0" />
              } @else {
                <span class="text-sm">✨</span>
              }
              <span>{{ provider.name }}</span>
            </button>
          }
        </div>

        <!-- 🔍 Discover In-Catalog Search Bar -->
        <div class="pt-3">
          <div class="relative max-w-xl group">
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search by show title, genre or keywords in catalog..."
              class="w-full bg-white/5 hover:bg-white/[0.08] focus:bg-white/10 border border-white/10 focus:border-blue-500/50 rounded-xl py-2.5 pl-10 pr-10 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none transition-all shadow-inner"
            />
            @if (searchQuery.trim().length > 0) {
              <button 
                (click)="clearSearch()" 
                class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 transition-colors"
                title="Clear search">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- 📺 Grid of Shows -->
      @if (loading()) {
        <div class="flex flex-col items-center justify-center py-24">
          <svg class="animate-spin h-10 w-10 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-zinc-400 text-sm font-semibold">Loading productions from TMDB...</p>
        </div>
      } @else if (shows().length === 0) {
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <p class="text-zinc-400 text-base font-semibold mb-2">No productions found for this filter combination.</p>
          <button (click)="resetFilters()" class="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold">Reset Filters</button>
        </div>
      } @else {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          @for (show of shows(); track show.id; let i = $index) {
            <div class="group cursor-pointer animate-slide-up" (click)="openDetails.emit(show)">
              <div class="relative aspect-[2/3] overflow-hidden rounded-2xl shadow-md hover-lift mb-2 border border-white/5 group-hover:border-white/20 transition-all">
                <img [src]="show.poster_path" [alt]="show.name" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                
                @if (state.isWatched(show.id)) {
                  <div class="absolute top-2 left-2 w-6 h-6 bg-emerald-500/95 text-white rounded-full flex items-center justify-center border border-emerald-400/30 backdrop-blur-sm shadow-lg z-20 animate-fade-in" title="Watched">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                } @else if (state.isInPending(show.id)) {
                  <div class="absolute top-2 left-2 w-6 h-6 bg-violet-600/95 text-white rounded-full flex items-center justify-center border border-violet-500/30 backdrop-blur-sm shadow-lg z-20 animate-fade-in" title="Pending">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                }

                @if (show.rating !== null) {
                  <div class="absolute top-2 right-2 px-2 py-0.5 bg-black/75 backdrop-blur-md rounded-md flex items-center gap-1 text-[11px] font-bold text-amber-400 border border-white/5">
                    <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                    {{ show.rating }}
                  </div>
                }

                <!-- Quick add button -->
                <button
                  (click)="toggleDropdown(show, $event)"
                  class="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white hover:text-blue-400 transition-all border border-white/10 z-40 flex items-center justify-center shadow-lg"
                  title="Quick add">
                  <svg class="w-3.5 h-3.5 transition-transform duration-200"
                       [class.rotate-180]="activeDropdownShow()?.id === show.id"
                       fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                <!-- Season dropdown overlay -->
                @if (activeDropdownShow()?.id === show.id) {
                  <div class="absolute inset-0 z-30 bg-slate-950/95 p-2.5 flex flex-col justify-between rounded-2xl border border-white/10 animate-fade-in" (click)="$event.stopPropagation()">
                    @if (dropdownLoading) {
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
                          <button (click)="activeDropdownShow.set(null); $event.stopPropagation()" class="text-zinc-500 hover:text-white p-0.5">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        </div>

                        @if (dropdownSeasonWarning) {
                          <div class="mb-1.5 p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[9px] leading-tight">
                            {{ dropdownSeasonWarning }}
                          </div>
                        }

                        <div class="grid grid-cols-4 gap-1">
                          @for (season of dropdownSeasonNumbers; track season) {
                            <button
                              (click)="selectDropdownSeason(season); $event.stopPropagation()"
                              [class]="dropdownSeasonsToAdd === season 
                                ? 'bg-blue-600 text-white font-bold' 
                                : (isDropdownSeasonAired(season) ? 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white' : 'bg-white/5 text-amber-400/60 hover:bg-white/10 border border-dashed border-amber-500/30')"
                              class="h-6 text-[10px] rounded transition-all relative">
                              {{ season }}
                              @if (!isDropdownSeasonAired(season)) {
                                <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                              }
                            </button>
                          }
                        </div>
                      </div>
                      
                      <div class="flex flex-col gap-1 shrink-0 mt-1 mb-8">
                        <button
                          (click)="addDropdownShow(); $event.stopPropagation()"
                          [disabled]="dropdownSeasonsToAdd === 0"
                          class="w-full py-1.5 bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1">
                          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                          Mark watched
                        </button>
                        
                        @if (state.isInPending(show.id)) {
                          <button
                            (click)="state.removePending(show.id); activeDropdownShow.set(null); $event.stopPropagation()"
                            class="w-full py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            Remove pending
                          </button>
                        } @else {
                          <button
                            (click)="state.addToPending(show); activeDropdownShow.set(null); $event.stopPropagation()"
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
              
              <div class="px-0.5">
                <h4 class="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors">{{ show.name }}</h4>
                <div class="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                  <span>{{ show.first_air_date | slice:0:4 }}</span>
                  @if (show.genres && show.genres.length > 0) {
                    <span>·</span>
                    <span class="truncate">{{ show.genres[0] }}</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <!-- 🔢 Pagination Controls -->
        <div class="flex items-center justify-center gap-2 mt-12 mb-6">
          <button 
            [disabled]="currentPage() === 1"
            (click)="goToPage(currentPage() - 1)"
            class="p-2.5 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          
          @for (p of getVisiblePages(); track p) {
            @if (p === -1) {
              <span class="px-2 text-zinc-600 font-bold select-none">...</span>
            } @else {
              <button 
                (click)="goToPage(p)"
                [class]="currentPage() === p ? 'bg-blue-600 border-blue-500 text-white font-bold' : 'border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'"
                class="w-10 h-10 rounded-xl border text-sm font-semibold transition-all">
                {{ p }}
              </button>
            }
          }

          <button 
            [disabled]="currentPage() === totalPages()"
            (click)="goToPage(currentPage() + 1)"
            class="p-2.5 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      }

    </div>
  `
})
export class TrendingComponent implements OnInit, OnDestroy {
  state = inject(ShowStateService);
  tmdb = inject(TmdbService);

  openDetails = output<TVShow>();

  /** Hero spotlight featured show. */
  heroShow = signal<TVShow | null>(null);

  /** Catalog shows list. */
  shows = signal<TVShow[]>([]);
  loading = signal(false);

  /** In-catalog search query. */
  searchQuery = '';
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  /** Pagination signals. */
  currentPage = signal(1);
  totalPages = signal(1);

  /** Filters signals. */
  selectedProvider = signal<number | null>(null);
  selectedSort = signal<string>('popularity.desc');
  selectedGenres = signal<string[]>([]);
  selectedDecade = signal<string | null>(null);
  selectedType = signal<'all' | 'miniseries' | 'series'>('all');

  activeDropdown = signal<'sort' | 'genre' | 'decade' | 'type' | null>(null);

  allGenres = ALL_GENRES;
  providers = POPULAR_PROVIDERS;

  sortOptions = [
    { label: '🔥 Most Popular', value: 'popularity.desc' },
    { label: '★ Highest Rated', value: 'vote_average.desc' },
    { label: '📅 Newest Releases', value: 'first_air_date.desc' }
  ];

  /** Quick add dropdown state */
  activeDropdownShow = signal<TVShow | null>(null);
  dropdownLoading = false;
  dropdownSeasonsToAdd = 0;
  dropdownSeasonWarning: string | null = null;

  constructor() {
    effect(() => {
      // Re-fetch catalog whenever user changes country in Region modal
      this.tmdb.selectedCountry();
      this.currentPage.set(1);
      this.loadCatalog();
    });
  }

  ngOnInit(): void {
    this.loadHeroShow();

    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        const trimmed = query.trim();
        if (!trimmed) {
          this.loadCatalog();
          return of(null);
        }
        this.loading.set(true);
        return this.tmdb.searchShows(trimmed);
      })
    ).subscribe(results => {
      if (results) {
        this.loading.set(false);
        this.shows.set(results);
        this.totalPages.set(1);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage.set(1);
    this.loadCatalog();
  }

  loadHeroShow(): void {
    this.tmdb.getTrendingShows().subscribe(trending => {
      if (trending.length > 0) {
        // Fetch full details for the #1 trending show to have 4K backdrop and info
        this.tmdb.getShowDetails(trending[0].id).subscribe(details => {
          if (details) this.heroShow.set(details);
          else this.heroShow.set(trending[0]);
        });
      }
    });
  }

  loadCatalog(): void {
    this.loading.set(true);
    this.tmdb.discoverShows({
      page: this.currentPage(),
      sortBy: this.selectedSort(),
      providerId: this.selectedProvider(),
      genreNames: this.selectedGenres(),
      decade: this.selectedDecade(),
      typeFilter: this.selectedType() === 'all' ? null : this.selectedType()
    }).subscribe(res => {
      this.loading.set(false);
      this.shows.set(res.shows);
      this.totalPages.set(res.totalPages);
    });
  }

  getSortLabel(): string {
    const opt = this.sortOptions.find(o => o.value === this.selectedSort());
    return opt ? opt.label : 'Popularity';
  }

  getGenreLabel(): string {
    return formatGenresLabel(this.selectedGenres());
  }

  isGenreSelected(genre: string): boolean {
    return this.selectedGenres().includes(genre);
  }

  toggleGenre(genre: string): void {
    const curr = this.selectedGenres();
    if (curr.includes(genre)) {
      this.selectedGenres.set(curr.filter(g => g !== genre));
    } else {
      this.selectedGenres.set([...curr, genre]);
    }
    this.currentPage.set(1);
    this.loadCatalog();
  }

  clearGenres(): void {
    this.selectedGenres.set([]);
    this.currentPage.set(1);
    this.loadCatalog();
  }

  getTypeLabel(): string {
    const type = this.selectedType();
    if (type === 'miniseries') return '⏱️ Miniseries';
    if (type === 'series') return '📺 Series';
    return 'ALL';
  }

  setType(type: 'all' | 'miniseries' | 'series'): void {
    this.selectedType.set(type);
    this.activeDropdown.set(null);
    this.currentPage.set(1);
    this.loadCatalog();
  }

  selectProvider(id: number): void {
    this.selectedProvider.set(id === 0 ? null : id);
    this.currentPage.set(1);
    this.loadCatalog();
  }

  setSort(sort: string): void {
    this.selectedSort.set(sort);
    this.activeDropdown.set(null);
    this.currentPage.set(1);
    this.loadCatalog();
  }

  setDecade(decade: string | null): void {
    this.selectedDecade.set(decade);
    this.activeDropdown.set(null);
    this.currentPage.set(1);
    this.loadCatalog();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedProvider.set(null);
    this.selectedSort.set('popularity.desc');
    this.selectedGenres.set([]);
    this.selectedDecade.set(null);
    this.selectedType.set('all');
    this.currentPage.set(1);
    this.loadCatalog();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadCatalog();
    const el = document.getElementById('discover-catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  getVisiblePages(): number[] {
    const current = this.currentPage();
    const total = this.totalPages();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: number[] = [];
    pages.push(1);
    if (current > 3) pages.push(-1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  toggleDropdown(show: TVShow, event: Event): void {
    event.stopPropagation();
    if (this.activeDropdownShow()?.id === show.id) {
      this.activeDropdownShow.set(null);
      this.dropdownSeasonsToAdd = 0;
      return;
    }
    this.dropdownLoading = true;
    this.dropdownSeasonWarning = null;
    this.activeDropdownShow.set(null);
    this.tmdb.getShowDetails(show.id).subscribe(result => {
      this.dropdownLoading = false;
      if (result) {
        this.activeDropdownShow.set(result);
        this.dropdownSeasonsToAdd = 0;
        this.dropdownSeasonWarning = null;
      }
    });
  }

  isDropdownSeasonAired(season: number): boolean {
    const show = this.activeDropdownShow();
    if (!show || !show.seasons || show.seasons.length === 0) return true;
    const s = show.seasons.find(item => item.season_number === season);
    return s ? s.is_aired !== false : true;
  }

  selectDropdownSeason(season: number): void {
    const show = this.activeDropdownShow();
    if (!show) return;
    const s = show.seasons?.find(item => item.season_number === season);
    if (s && s.is_aired === false) {
      const airMsg = s.air_date ? ` (airs on ${s.air_date})` : '';
      this.dropdownSeasonWarning = `Season ${season} not released yet${airMsg}.`;
      return;
    }
    this.dropdownSeasonWarning = null;
    this.dropdownSeasonsToAdd = season;
  }

  get dropdownSeasonNumbers(): number[] {
    const show = this.activeDropdownShow();
    if (!show?.number_of_seasons) return [];
    return Array.from({ length: show.number_of_seasons }, (_, i) => i + 1);
  }

  addDropdownShow(): void {
    const show = this.activeDropdownShow();
    if (!show || this.dropdownSeasonsToAdd === 0) return;

    const unreleased = show.seasons?.find(s => s.season_number <= this.dropdownSeasonsToAdd && s.is_aired === false);
    if (unreleased) {
      const airMsg = unreleased.air_date ? ` (airs on ${unreleased.air_date})` : '';
      this.dropdownSeasonWarning = `Season ${unreleased.season_number} not released yet${airMsg}.`;
      return;
    }

    this.state.addWatchedShow(show, this.dropdownSeasonsToAdd);
    this.activeDropdownShow.set(null);
    this.dropdownSeasonsToAdd = 0;
    this.dropdownSeasonWarning = null;
  }
}
