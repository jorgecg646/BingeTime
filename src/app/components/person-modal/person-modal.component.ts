import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TmdbService } from '../../services/tmdb.service';
import { ShowStateService } from '../../services/show-state.service';
import { PersonDetail, PersonTvCreditShow } from '../../models';

/**
 * Full Biographical Profile & TV Filmography Modal for Actors, Directors & Creators.
 * Displays high-res photos, biography, social media links, and interactive TV filmography
 * sorted by popularity, rating, or release year with one-click show exploration.
 */
@Component({
  selector: 'app-person-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (personId()) {
      <div 
        class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in"
        (click)="closeOnBackdrop($event)">
        
        <div 
          class="relative w-full max-w-4xl bg-zinc-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl my-auto text-white max-h-[92vh] flex flex-col animate-scale-in"
          (click)="$event.stopPropagation()">

          <!-- ✕ Close Button -->
          <button 
            (click)="close()"
            class="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-lg group">
            <svg class="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>

          <!-- Loading State -->
          @if (isLoading()) {
            <div class="flex flex-col items-center justify-center py-32 space-y-4">
              <div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p class="text-sm font-bold text-zinc-400">Loading profile & filmography...</p>
            </div>
          } @else if (person()) {
            
            <!-- Scrollable Content Container -->
            <div class="overflow-y-auto custom-scrollbar flex-1">
              
              <!-- 🌟 Header Section: Profile, Bio & Socials -->
              <div class="relative p-6 sm:p-8 bg-gradient-to-b from-blue-950/30 via-zinc-900/40 to-zinc-950 border-b border-white/10">
                <div class="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                  
                  <!-- HD Portrait Photo -->
                  <div class="relative shrink-0 group">
                    <div class="w-36 h-48 sm:w-44 sm:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900">
                      @if (person()!.profile_path) {
                        <img 
                          [src]="person()!.profile_path" 
                          [alt]="person()!.name" 
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      } @else {
                        <div class="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs font-bold gap-2">
                          <svg class="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          <span>No Photo</span>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Biographical Information -->
                  <div class="flex-1 text-center sm:text-left min-w-0">
                    
                    <!-- Department & Popularity Badges -->
                    <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                      <span class="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
                        🎭 {{ person()!.known_for_department }}
                      </span>
                      @if (person()!.popularity > 0) {
                        <span class="px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-bold flex items-center gap-1">
                          🔥 {{ person()!.popularity }} Score
                        </span>
                      }
                    </div>

                    <!-- Name -->
                    <h2 class="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2">
                      {{ person()!.name }}
                    </h2>

                    <!-- Birth, Age & Place of Birth Meta -->
                    <div class="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-zinc-400 font-semibold mb-4">
                      @if (birthInfo()) {
                        <span class="flex items-center gap-1">
                          <span>🎂</span>
                          <span>{{ birthInfo() }}</span>
                        </span>
                      }
                      @if (person()!.place_of_birth) {
                        <span class="flex items-center gap-1 truncate max-w-xs">
                          <span>📍</span>
                          <span>{{ person()!.place_of_birth }}</span>
                        </span>
                      }
                    </div>

                    <!-- 🌐 Social Media Links -->
                    @if (hasSocialLinks()) {
                      <div class="flex items-center justify-center sm:justify-start gap-2 mb-4">
                        @if (person()!.external_ids?.imdb_id) {
                          <a 
                            [href]="'https://www.imdb.com/name/' + person()!.external_ids!.imdb_id" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="px-2.5 py-1 rounded-lg bg-[#f5c518] hover:bg-[#e2b616] text-black font-black text-[11px] tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95"
                            title="View IMDb Profile">
                            IMDb
                          </a>
                        }
                        @if (person()!.external_ids?.instagram_id) {
                          <a 
                            [href]="'https://instagram.com/' + person()!.external_ids!.instagram_id" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="p-1.5 rounded-lg bg-pink-600/20 hover:bg-pink-600/40 border border-pink-500/30 text-pink-300 transition-all flex items-center justify-center active:scale-95"
                            title="Instagram">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                          </a>
                        }
                        @if (person()!.external_ids?.twitter_id) {
                          <a 
                            [href]="'https://twitter.com/' + person()!.external_ids!.twitter_id" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/30 text-sky-300 transition-all flex items-center justify-center active:scale-95"
                            title="X (Twitter)">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                          </a>
                        }
                        @if (person()!.external_ids?.tiktok_id) {
                          <a 
                            [href]="'https://tiktok.com/@' + person()!.external_ids!.tiktok_id" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all flex items-center justify-center active:scale-95"
                            title="TikTok">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                          </a>
                        }
                      </div>
                    }

                    <!-- Biography -->
                    @if (person()!.biography) {
                      <div class="relative text-left">
                        <p 
                          [class.line-clamp-3]="!isBioExpanded()"
                          class="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                          {{ person()!.biography }}
                        </p>
                        @if (person()!.biography.length > 220) {
                          <button 
                            (click)="isBioExpanded.set(!isBioExpanded())"
                            class="text-xs text-blue-400 hover:text-blue-300 font-bold mt-1 transition-colors">
                            {{ isBioExpanded() ? '▲ Show less' : '▼ Read more' }}
                          </button>
                        }
                      </div>
                    } @else {
                      <p class="text-xs text-zinc-500 italic text-left">No biography available for this person.</p>
                    }

                  </div>
                </div>
              </div>

              <!-- 🎬 Filmography Section -->
              <div class="p-6 sm:p-8">
                
                <!-- Toolbar: Credits Tab Switcher + Sort Options -->
                <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                  
                  <!-- Tabs: Cast vs Crew -->
                  <div class="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
                    <button 
                      (click)="activeTab.set('cast')"
                      [class]="activeTab() === 'cast' 
                        ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30' 
                        : 'text-zinc-400 hover:text-white'"
                      class="px-4 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5">
                      <span>🎭 Acting</span>
                      <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-black/40 font-mono">{{ castCredits().length }}</span>
                    </button>

                    @if (crewCredits().length > 0) {
                      <button 
                        (click)="activeTab.set('crew')"
                        [class]="activeTab() === 'crew' 
                          ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30' 
                          : 'text-zinc-400 hover:text-white'"
                        class="px-4 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5">
                        <span>🎬 Directing / Crew</span>
                        <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-black/40 font-mono">{{ crewCredits().length }}</span>
                      </button>
                    }
                  </div>

                  <!-- Sort Buttons -->
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 hidden sm:inline">Sort:</span>
                    <button 
                      (click)="activeSort.set('popularity')"
                      [class]="activeSort() === 'popularity' ? 'bg-white text-black font-bold' : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'"
                      class="px-3 py-1 rounded-xl text-xs transition-all flex items-center gap-1">
                      <span>🔥 Popular</span>
                    </button>
                    <button 
                      (click)="activeSort.set('rating')"
                      [class]="activeSort() === 'rating' ? 'bg-white text-black font-bold' : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'"
                      class="px-3 py-1 rounded-xl text-xs transition-all flex items-center gap-1">
                      <span>★ Rating</span>
                    </button>
                    <button 
                      (click)="activeSort.set('newest')"
                      [class]="activeSort() === 'newest' ? 'bg-white text-black font-bold' : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'"
                      class="px-3 py-1 rounded-xl text-xs transition-all flex items-center gap-1">
                      <span>📅 Year</span>
                    </button>
                  </div>

                </div>

                <!-- TV Shows Filmography Grid -->
                @if (displayedCredits().length > 0) {
                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
                    @for (show of displayedCredits(); track show.id) {
                      <div 
                        (click)="openShow(show.id)"
                        class="group bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/10 hover:border-blue-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 cursor-pointer flex flex-col">
                        
                        <!-- Poster Thumbnail -->
                        <div class="relative aspect-[2/3] w-full bg-zinc-800 overflow-hidden">
                          @if (show.poster_path) {
                            <img 
                              [src]="show.poster_path" 
                              [alt]="show.name" 
                              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                              loading="lazy" />
                          } @else {
                            <div class="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-xs font-bold p-2 text-center">
                              No Image
                            </div>
                          }

                          <!-- Rating Badge -->
                          @if (show.vote_average) {
                            <div class="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-bold flex items-center gap-0.5 shadow-md">
                              <span>★</span>
                              <span>{{ show.vote_average }}</span>
                            </div>
                          }

                          <!-- Episodes Count Badge -->
                          @if (show.episode_count) {
                            <div class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-blue-600/90 text-white text-[9px] font-bold shadow-md">
                              {{ show.episode_count }} eps
                            </div>
                          }
                        </div>

                        <!-- Info Footer -->
                        <div class="p-2.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 class="text-xs font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                              {{ show.name }}
                            </h4>
                            <p class="text-[11px] text-zinc-400 line-clamp-1 italic">
                              {{ show.character || show.job || 'Cast' }}
                            </p>
                          </div>

                          <div class="flex items-center justify-between mt-2 pt-1 border-t border-white/5 text-[10px] text-zinc-500">
                            <span>{{ show.first_air_date ? (show.first_air_date | slice:0:4) : '—' }}</span>
                            <span class="text-blue-400 font-semibold group-hover:underline">View Show →</span>
                          </div>
                        </div>

                      </div>
                    }
                  </div>
                } @else {
                  <div class="text-center py-16 text-zinc-500">
                    <p class="text-sm font-semibold">No TV credits found in this category.</p>
                  </div>
                }

              </div>

            </div>
          }

        </div>
      </div>
    }
  `
})
export class PersonModalComponent {
  private tmdb = inject(TmdbService);
  private showState = inject(ShowStateService);

  personId = computed(() => this.tmdb.activePersonModalId());
  person = signal<PersonDetail | null>(null);
  isLoading = signal<boolean>(false);

  activeTab = signal<'cast' | 'crew'>('cast');
  activeSort = signal<'popularity' | 'rating' | 'newest'>('popularity');
  isBioExpanded = signal<boolean>(false);

  constructor() {
    // Whenever personId changes, fetch fresh details
    effect(() => {
      const id = this.personId();
      if (id) {
        this.loadPerson(id);
      } else {
        this.person.set(null);
      }
    });
  }

  loadPerson(personId: number): void {
    this.isLoading.set(true);
    this.isBioExpanded.set(false);
    this.activeSort.set('popularity');

    this.tmdb.getPersonDetails(personId).subscribe({
      next: (details) => {
        this.person.set(details);
        // Default to whichever category has credits
        if (details.tv_credits?.cast && details.tv_credits.cast.length > 0) {
          this.activeTab.set('cast');
        } else if (details.tv_credits?.crew && details.tv_credits.crew.length > 0) {
          this.activeTab.set('crew');
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  castCredits = computed(() => this.person()?.tv_credits?.cast || []);
  crewCredits = computed(() => this.person()?.tv_credits?.crew || []);

  displayedCredits = computed(() => {
    const list = this.activeTab() === 'cast' ? [...this.castCredits()] : [...this.crewCredits()];
    const sort = this.activeSort();

    if (sort === 'popularity') {
      return list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    } else if (sort === 'rating') {
      return list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    } else if (sort === 'newest') {
      return list.sort((a, b) => (b.first_air_date || '').localeCompare(a.first_air_date || ''));
    }
    return list;
  });

  hasSocialLinks = computed(() => {
    const ids = this.person()?.external_ids;
    if (!ids) return false;
    return !!(ids.imdb_id || ids.instagram_id || ids.twitter_id || ids.tiktok_id);
  });

  birthInfo = computed(() => {
    const p = this.person();
    if (!p || !p.birthday) return null;

    const bYear = parseInt(p.birthday.slice(0, 4), 10);
    if (isNaN(bYear)) return p.birthday;

    if (p.deathday) {
      const dYear = parseInt(p.deathday.slice(0, 4), 10);
      const ageAtDeath = !isNaN(dYear) ? dYear - bYear : null;
      return `${p.birthday} — ${p.deathday}${ageAtDeath ? ` (aged ${ageAtDeath})` : ''}`;
    }

    const currentYear = new Date().getFullYear();
    const age = currentYear - bYear;
    return `${p.birthday} (${age} years old)`;
  });

  close(): void {
    this.tmdb.closePersonModal();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  openShow(showId: number): void {
    this.close();
    this.showState.openDetailsById(showId);
  }
}
