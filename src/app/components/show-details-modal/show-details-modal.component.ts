import { Component, input, output, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TVShow } from '../../models';
import { ShowStateService } from '../../services/show-state.service';
import { TmdbService } from '../../services/tmdb.service';

/**
 * Modal component that displays detailed information about a TV show.
 * Optimized for ultra-smooth 60 FPS desktop and mobile performance.
 */
@Component({
  selector: 'app-show-details-modal',
  standalone: true,
  imports: [SlicePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <!-- Backdrop (Lightweight, GPU-friendly overlay) -->
      <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in" (click)="close.emit()">
        <div class="bg-[#0c101d] rounded-3xl max-w-4xl w-full animate-fade-in-scale relative overflow-hidden max-h-[92vh] flex flex-col border border-white/10 shadow-2xl" 
             style="will-change: transform; transform: translateZ(0);"
             (click)="$event.stopPropagation()">
          
          <!-- Cinematic 4K Backdrop Header -->
          @if (show()!.backdrop_path) {
            <div class="absolute inset-x-0 top-0 h-48 md:h-64 overflow-hidden pointer-events-none opacity-20">
              <img [src]="show()!.backdrop_path" class="w-full h-full object-cover" alt="" loading="lazy" />
              <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#0c101d]/80 to-[#0c101d]"></div>
            </div>
          }

          <!-- Header Actions (Share & Close) -->
          <div class="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button (click)="copyShareLink()" class="p-2 rounded-full bg-black/70 hover:bg-black border border-white/10 text-zinc-300 hover:text-white transition-all flex items-center justify-center" [title]="copied() ? 'Link copied!' : 'Copy shareable link'">
              @if (copied()) {
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
              } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
              }
            </button>

            <button (click)="close.emit()" class="p-2 rounded-full bg-black/70 hover:bg-black border border-white/10 text-zinc-300 hover:text-white transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div class="overflow-y-auto p-5 sm:p-7 md:p-8 flex-grow custom-scrollbar relative z-10">
            <div class="grid grid-cols-1 md:grid-cols-[13rem_1fr] gap-6 relative">
              
              <!-- Left Column (Poster + Actions + Trailer) -->
              <div class="flex flex-col gap-4">
                <div class="w-full shrink-0 flex justify-center md:block">
                  <img [src]="show()!.poster_path" [alt]="show()!.name" class="w-44 h-64 md:w-52 md:h-76 object-cover rounded-2xl shadow-xl border border-white/10" />
                </div>
                
                <!-- Action Buttons under the Poster -->
                <div class="flex flex-col gap-2.5 w-full">
                  @if (instances().length > 0) {
                    <button (click)="addAgain.emit(show()!)" class="w-full py-2.5 px-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                      Add again
                    </button>
                  } @else {
                    <button (click)="addAgain.emit(show()!)" class="w-full py-2.5 px-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                      Mark as watched
                    </button>
                  }
                  
                  @if (state.isInPending(show()!.id)) {
                    <button (click)="state.removePending(show()!.id); close.emit()" class="w-full py-2.5 px-3 bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      Remove pending
                    </button>
                  } @else {
                    <button (click)="state.addToPending(show()!); close.emit()" class="w-full py-2.5 px-3 bg-violet-600/25 border border-violet-500/35 text-violet-300 hover:bg-violet-600/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Add to pending
                    </button>
                  }

                  <!-- Official Trailer Button -->
                  <button (click)="openTrailer()" class="w-full py-2.5 px-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-red-600/20">
                    <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                    Watch Trailer
                  </button>
                </div>
              </div>
              
              <!-- Right Column (Content + Streaming Providers + Reviews + Recommendations) -->
              <div class="flex-grow min-w-0 flex flex-col justify-between">
                <div>
                  <h3 class="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">{{ show()!.name }}</h3>
                  
                  <div class="flex flex-wrap items-center gap-3 text-xs md:text-sm text-zinc-400 mb-3">
                    <span>{{ show()!.first_air_date | slice:0:4 }}</span>
                    @if (show()!.number_of_seasons) {
                      <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                      <span>{{ show()!.number_of_seasons }} season{{ show()!.number_of_seasons !== 1 ? 's' : '' }}</span>
                    }
                    <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                    <span>~{{ show()!.episode_run_time || 45 }} min/ep</span>

                    @if (show()!.rating !== null) {
                      <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                      <span class="text-amber-400 font-bold flex items-center gap-1">★ {{ show()!.rating }}</span>
                    }
                  </div>

                  <!-- Network & Status Badges -->
                  <div class="flex flex-wrap items-center gap-2 mb-3">
                    @if (show()!.networks && show()!.networks!.length > 0) {
                      @for (net of show()!.networks; track net.id) {
                        <div class="flex items-center gap-1.5 px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-zinc-300">
                          @if (net.logo_path) {
                            <img [src]="net.logo_path" [alt]="net.name" class="h-3 object-contain invert opacity-80" />
                          }
                          <span>{{ net.name }}</span>
                        </div>
                      }
                    }
                    @if (show()!.status) {
                      <span class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
                            [class]="show()!.status === 'Ended' ? 'bg-zinc-800/80 text-zinc-400 border border-white/5' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'">
                        {{ show()!.status }}
                      </span>
                    }
                  </div>

                  <!-- Genres Tags -->
                  @if (show()!.genres && show()!.genres!.length > 0) {
                    <div class="flex flex-wrap gap-1.5 mb-4">
                      @for (g of show()!.genres; track g) {
                        <span class="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-zinc-300">{{ g }}</span>
                      }
                    </div>
                  }
                  
                  <div class="text-zinc-300 text-sm leading-relaxed mb-5 max-h-40 overflow-y-auto pr-2 custom-scrollbar" [innerHTML]="show()!.summary"></div>

                  <!-- 📺 Streaming Providers ("Where to Watch" with JustWatch-Style Region Switcher) -->
                  <div class="mb-5 p-3.5 bg-white/[0.04] border border-white/10 rounded-2xl relative">
                    <div class="flex items-center justify-between mb-2.5">
                      <p class="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        <span>Where to Watch</span>
                      </p>

                      <!-- Country Switcher Button (Opens JustWatch-style Modal) -->
                      <button (click)="tmdb.openRegionModal()" 
                              class="px-2.5 py-1 rounded-xl bg-black/60 hover:bg-black/90 border border-white/15 text-xs font-bold text-zinc-200 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95">
                        <img [src]="tmdb.activeCountryFlagUrl()" class="w-4 h-3 object-cover rounded-sm shadow-sm" [alt]="tmdb.activeCountry()" />
                        <span>{{ tmdb.activeCountry() }}</span>
                        <svg class="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                    </div>

                    <!-- Platform Badges for Selected Country -->
                    @if (currentWatchProviders().length > 0) {
                      <div class="flex flex-wrap gap-2 items-center">
                        @for (provider of currentWatchProviders(); track provider.provider_id) {
                          <div class="flex items-center gap-2 px-2.5 py-1 bg-black/50 border border-white/10 rounded-xl" [title]="provider.provider_name">
                            <img [src]="provider.logo_path" [alt]="provider.provider_name" class="w-5 h-5 rounded-md object-cover shadow" />
                            <span class="text-xs font-semibold text-zinc-200">{{ provider.provider_name }}</span>
                          </div>
                        }
                      </div>
                    } @else {
                      <p class="text-xs text-zinc-400 italic py-1">
                        No streaming subscription currently available in {{ tmdb.activeCountryName() }}.
                      </p>
                    }
                  </div>

                  <!-- 🎭 Top Cast Carousel -->
                  @if (show()!.cast && show()!.cast!.length > 0) {
                    <div class="mb-5">
                      <div class="flex items-center justify-between mb-2">
                        <p class="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <span>🎭 Top Cast</span>
                        </p>
                        <div class="flex items-center gap-1">
                          <button (click)="scrollCarousel(castList, -240)" class="p-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                          </button>
                          <button (click)="scrollCarousel(castList, 240)" class="p-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                          </button>
                        </div>
                      </div>
                      
                      <div #castList class="flex gap-3 overflow-x-auto pb-2 scroll-smooth no-scrollbar" style="contain: content;">
                        @for (actor of show()!.cast; track actor.id) {
                          <div class="flex-none w-24 text-center group">
                            <div class="w-20 h-20 mx-auto rounded-full overflow-hidden mb-1.5 border border-white/10 shadow-sm bg-white/5">
                              @if (actor.profile_path) {
                                <img [src]="actor.profile_path" [alt]="actor.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                              } @else {
                                <div class="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-bold">No photo</div>
                              }
                            </div>
                            <p class="text-white text-[11px] font-bold truncate">{{ actor.name }}</p>
                            <p class="text-zinc-500 text-[10px] truncate">{{ actor.character }}</p>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- 📋 Watched Instances Section -->
                @if (instances().length > 0) {
                  <div class="mt-4 pt-4 border-t border-white/10">
                    <h4 class="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                      Watched {{ instances().length }} time{{ instances().length !== 1 ? 's' : '' }}
                    </h4>
                    
                    <div class="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      @for (item of instances(); track item.instanceId; let idx = $index) {
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
                          <div class="flex items-center gap-3">
                            <span class="font-bold text-zinc-300">Copy #{{ idx + 1 }}</span>
                            <span class="text-zinc-400">Seasons: <strong class="text-white">{{ item.seasonsWatched }}/{{ item.show.number_of_seasons }}</strong></span>
                            <div class="flex items-center gap-1">
                              <span class="text-zinc-500">Rating:</span>
                              <select [ngModel]="item.userRating" (ngModelChange)="state.setUserRating(item, +$event)" 
                                      class="bg-black/50 border border-white/15 rounded px-1 py-0.5 text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer">
                                <option [ngValue]="0">--</option>
                                <option [ngValue]="1">1</option>
                                <option [ngValue]="2">2</option>
                                <option [ngValue]="3">3</option>
                                <option [ngValue]="4">4</option>
                                <option [ngValue]="5">5</option>
                                <option [ngValue]="6">6</option>
                                <option [ngValue]="7">7</option>
                                <option [ngValue]="8">8</option>
                                <option [ngValue]="9">9</option>
                                <option [ngValue]="10">10</option>
                              </select>
                            </div>
                          </div>
                          <button (click)="state.removeShow(item.instanceId)" class="p-1 text-zinc-500 hover:text-red-400 transition-colors" title="Delete copy">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- 💡 More Like This (Recommendations Carousel) -->
                @if (show()!.recommendations && show()!.recommendations!.length > 0) {
                  <div class="mt-6 pt-5 border-t border-white/10">
                    <div class="flex items-center justify-between mb-3">
                      <h4 class="text-white font-bold text-base flex items-center gap-2">
                        <span>💡 More Like This</span>
                      </h4>
                      <div class="flex items-center gap-1.5">
                        <button (click)="scrollCarousel(recList, -320)" class="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        <button (click)="scrollCarousel(recList, 320)" class="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                      </div>
                    </div>
                    
                    <div #recList class="flex gap-3 overflow-x-auto pb-3 scroll-smooth no-scrollbar" style="contain: content;">
                      @for (rec of show()!.recommendations; track rec.id) {
                        <div class="flex-none w-36 sm:w-40 group">
                          <div class="relative cursor-pointer overflow-hidden rounded-xl border border-white/10" (click)="state.openDetails(rec)">
                            <img [src]="rec.poster_path" [alt]="rec.name" class="w-full h-48 sm:h-56 object-cover rounded-xl shadow-md group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                            @if (rec.rating) {
                              <div class="absolute bottom-2 right-2 bg-black/85 px-2 py-0.5 rounded-lg text-[11px] font-black text-amber-400 border border-white/10 shadow-lg">
                                ★ {{ rec.rating }}
                              </div>
                            }
                          </div>
                          <p class="text-white text-xs sm:text-sm font-bold truncate mt-2 cursor-pointer hover:text-amber-400 transition-colors" (click)="state.openDetails(rec)">{{ rec.name }}</p>
                          <button (click)="state.addToPending(rec); $event.stopPropagation()" 
                                  [disabled]="state.isInPending(rec.id)"
                                  class="mt-2 w-full py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 shadow"
                                  [class]="state.isInPending(rec.id) ? 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5' : 'bg-violet-600/40 hover:bg-violet-600/60 active:scale-95 text-violet-200 border border-violet-500/40'">
                            {{ state.isInPending(rec.id) ? 'In Pending' : '+ Pending' }}
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- 💬 TMDB Community Reviews -->
                @if (show()!.reviews && show()!.reviews!.length > 0) {
                  <div class="mt-6 pt-5 border-t border-white/10">
                    <h4 class="text-white font-bold text-base mb-3 flex items-center gap-2">
                      <span>💬 Community Reviews</span>
                    </h4>
                    <div class="flex flex-col gap-3.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                      @for (review of show()!.reviews; track review.id) {
                        <div class="p-4 bg-white/[0.04] border border-white/10 rounded-2xl">
                          <div class="flex items-center justify-between gap-2 mb-2.5">
                            <div class="flex items-center gap-2.5">
                              @if (review.avatar_path) {
                                <img [src]="review.avatar_path" class="w-8 h-8 rounded-full object-cover border border-white/15 shadow-sm" alt="" loading="lazy" />
                              } @else {
                                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                  {{ review.author.slice(0, 1).toUpperCase() }}
                                </div>
                              }
                              <div>
                                <p class="text-white text-xs sm:text-sm font-bold">{{ review.author }}</p>
                                <p class="text-zinc-500 text-[10px]">{{ review.created_at }}</p>
                              </div>
                            </div>
                            @if (review.rating) {
                              <span class="px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-black flex items-center gap-1">
                                ★ {{ review.rating }}/10
                              </span>
                            }
                          </div>
                          <p class="text-zinc-300 text-sm leading-relaxed">{{ review.content }}</p>
                        </div>
                      }
                    </div>
                  </div>
                }

              </div>
            </div>
          </div>

        </div>
      </div>
    }

    <!-- YouTube Trailer Modal Player -->
    @if (selectedTrailerVideoUrl()) {
      <div class="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in" (click)="closeTrailer()">
        <div class="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/15 animate-fade-in-scale" (click)="$event.stopPropagation()">
          <button (click)="closeTrailer()" class="absolute top-4 right-4 p-2.5 rounded-full bg-black/80 hover:bg-black text-white hover:scale-110 transition-all z-20 shadow-xl border border-white/10">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <iframe 
            [src]="selectedTrailerVideoUrl()!" 
            class="w-full h-full" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
      </div>
    }
  `
})
export class ShowDetailsModalComponent {
  state = inject(ShowStateService);
  tmdb = inject(TmdbService);
  private sanitizer = inject(DomSanitizer);

  /** The show to display details for. Null when the modal is closed. */
  show = input<TVShow | null>(null);
  /** Emits when the user closes the modal. */
  close = output<void>();
  /** Emits the show when the user wants to add it (or add again) to their watchlist. */
  addAgain = output<TVShow>();

  /**
   * Computed list of streaming platforms for the currently selected country.
   */
  currentWatchProviders = computed(() => {
    const s = this.show();
    if (!s) return [];
    const country = this.tmdb.selectedCountry();
    if (s.all_watch_providers && s.all_watch_providers[country]) {
      return s.all_watch_providers[country];
    }
    return s.watch_providers || [];
  });

  /** Computed primary YouTube trailer for the show. */
  primaryTrailer = computed(() => {
    const s = this.show();
    if (!s || !s.videos || s.videos.length === 0) return null;
    return s.videos.find(v => v.official && v.type === 'Trailer') || s.videos[0];
  });

  /** Safe iframe URL for active YouTube trailer. */
  selectedTrailerVideoUrl = signal<SafeResourceUrl | null>(null);

  /** Smoothly scrolls a horizontal container by the given pixel offset. */
  scrollCarousel(element: HTMLElement, offset: number): void {
    if (element) {
      element.scrollBy({ left: offset, behavior: 'smooth' });
    }
  }

  /** Opens the trailer video player. */
  openTrailer(): void {
    const s = this.show();
    if (!s) return;
    const trailer = this.primaryTrailer();
    let url: string;
    if (trailer) {
      url = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1`;
    } else {
      const query = encodeURIComponent(`${s.name} official trailer`);
      url = `https://www.youtube-nocookie.com/embed?listType=search&list=${query}&autoplay=1`;
    }
    this.selectedTrailerVideoUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }

  /** Closes the trailer player modal. */
  closeTrailer(): void {
    this.selectedTrailerVideoUrl.set(null);
  }

  /**
   * Computed list of all watched instances for the currently displayed show.
   * Allows the user to see and manage multiple watch entries.
   */
  instances = computed(() => {
    const s = this.show();
    if (!s) return [];
    return this.state.watchedShows().filter(w => w.show.id === s.id);
  });

  /** Whether the "link copied" feedback is currently visible. */
  copied = signal(false);

  /**
   * Copies a shareable URL (with ?show=ID query param) to the clipboard
   * and shows a brief confirmation indicator.
   */
  copyShareLink(): void {
    const show = this.show();
    if (!show) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?show=${show.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
