import { Component, input, output, inject, computed, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TVShow } from '../../models';
import { ShowStateService } from '../../services/show-state.service';

/**
 * Modal component that displays detailed information about a TV show.
 * Shows the poster, summary, metadata, action buttons (watch/pending),
 * a shareable link, and a list of all watch instances if already tracked.
 */
@Component({
  selector: 'app-show-details-modal',
  standalone: true,
  imports: [SlicePipe, FormsModule],
  template: `
    @if (show()) {
      <div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" (click)="close.emit()">
        <div class="glass-strong rounded-3xl p-6 md:p-8 max-w-3xl w-full animate-fade-in-scale relative overflow-hidden max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
          
          <!-- Share button -->
          <button (click)="copyShareLink()" class="absolute top-4 right-14 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all z-10 flex items-center justify-center" [title]="copied() ? 'Link copied!' : 'Copy shareable link'">
            @if (copied()) {
              <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
            } @else {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
            }
          </button>

          <!-- Close button -->
          <button (click)="close.emit()" class="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all z-10">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          
          <div class="overflow-y-auto pr-1 flex-grow custom-scrollbar">
            <div class="grid grid-cols-1 md:grid-cols-[12rem_1fr] gap-6 relative">
              <!-- Left Column (Poster + Actions) -->
              <div class="flex flex-col gap-4">
                <div class="w-full shrink-0 flex justify-center md:block">
                  <img [src]="show()!.poster_path" [alt]="show()!.name" class="w-40 h-56 md:w-48 md:h-68 object-cover rounded-2xl shadow-2xl border border-white/10" />
                </div>
                
                <!-- Action Buttons under the Poster -->
                <div class="flex flex-col gap-2.5 w-full">
                  @if (instances().length > 0) {
                    <button (click)="addAgain.emit(show()!)" class="w-full py-2.5 px-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                      Add again
                    </button>
                  } @else {
                    <button (click)="addAgain.emit(show()!)" class="w-full py-2.5 px-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                      Mark as watched
                    </button>
                  }
                  
                  @if (state.isInPending(show()!.id)) {
                    <button (click)="state.removePending(show()!.id); close.emit()" class="w-full py-2.5 px-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      Remove pending
                    </button>
                  } @else {
                    <button (click)="state.addToPending(show()!); close.emit()" class="w-full py-2.5 px-3 bg-violet-600/10 border border-violet-500/25 text-violet-300 hover:bg-violet-600/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Add to pending
                    </button>
                  }
                </div>
              </div>
              
              <!-- Right Column (Content + Watched copies) -->
              <div class="flex-grow min-w-0 flex flex-col justify-between">
                <div>
                  <h3 class="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">{{ show()!.name }}</h3>
                  
                  <div class="flex flex-wrap items-center gap-3 text-xs md:text-sm text-zinc-400 mb-4">
                    <span>{{ show()!.first_air_date | slice:0:4 }}</span>
                    @if (show()!.number_of_seasons) {
                      <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                      <span>{{ show()!.number_of_seasons }} seasons</span>
                    }
                    <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                    <span>~{{ show()!.episode_run_time }} min/ep</span>
                  </div>
                  
                  <div class="text-zinc-300 text-sm leading-relaxed mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar" [innerHTML]="show()!.summary"></div>
                </div>

                <!-- Watched instances section inside right column -->
                @if (instances().length > 0) {
                  <div class="border-t border-white/10 pt-5 mt-4">
                    <h4 class="text-emerald-400 font-semibold text-sm flex items-center gap-1.5 mb-3">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                      Watched {{ instances().length }} {{ instances().length === 1 ? 'time' : 'times' }}
                    </h4>
                    
                    <div class="flex flex-col gap-2">
                      @for (instance of instances(); track instance.instanceId; let idx = $index) {
                        <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/5 border border-white/5 rounded-xl text-xs">
                          <span class="font-bold text-zinc-300">Copy #{{ idx + 1 }}</span>
                          
                          <span class="text-zinc-400 uppercase font-semibold text-[10px]">
                            Seasons: <strong class="text-white">{{ instance.seasonsWatched }}/{{ instance.show.number_of_seasons }}</strong>
                          </span>
                          
                          <div class="flex items-center gap-1.5">
                            <span class="text-zinc-500 text-[10px] font-semibold uppercase">Rating:</span>
                            <select 
                              [ngModel]="instance.userRating" 
                              (ngModelChange)="state.setUserRating(instance, $event)"
                              class="bg-zinc-900 border border-white/10 rounded-lg text-white py-1 px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px] font-semibold cursor-pointer">
                              <option [value]="0">--</option>
                              @for (rating of [1,2,3,4,5,6,7,8,9,10]; track rating) {
                                <option [value]="rating">{{ rating }}</option>
                              }
                            </select>
                          </div>
                          
                          <button (click)="state.removeShow(instance.instanceId)" class="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all" title="Remove this copy">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
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
  `
})
export class ShowDetailsModalComponent {
  state = inject(ShowStateService);

  /** The show to display details for. Null when the modal is closed. */
  show = input<TVShow | null>(null);
  /** Emits when the user closes the modal. */
  close = output<void>();
  /** Emits the show when the user wants to add it (or add again) to their watchlist. */
  addAgain = output<TVShow>();

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
