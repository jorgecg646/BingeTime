import { Component, inject, signal, computed, output, input, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TmdbService } from '../../services/tmdb.service';

/**
 * JustWatch-style Region Selection Modal.
 * Displays currently selected country, searchable country list with high-res flag icons from FlagCDN.
 * Optimized with Angular Signals for real-time instant search and 60 FPS performance.
 */
@Component({
  selector: 'app-region-modal',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 animate-fade-in" (click)="close.emit()">
        <div class="bg-[#090d16] border border-white/10 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-fade-in-scale flex flex-col max-h-[85vh]"
             style="will-change: transform; transform: translateZ(0);"
             (click)="$event.stopPropagation()">
          
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 class="text-xl font-bold text-white tracking-tight">Región</h2>
            <button (click)="close.emit()" class="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          <!-- Current Selected Country Banner -->
          @if (currentCountry()) {
            <div class="px-6 py-2">
              <div class="flex items-center gap-3 py-2.5 px-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <img [src]="currentCountry()!.flagUrl" [alt]="currentCountry()!.name" loading="lazy" decoding="async" class="w-6 h-4.5 object-cover rounded shadow-sm shrink-0" />
                <span class="text-sm font-bold text-white">{{ currentCountry()!.name }}</span>
                <span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-300 font-bold uppercase">{{ currentCountry()!.code }}</span>
              </div>
            </div>
          }

          <div class="h-px bg-white/5 mx-6 my-2"></div>

          <!-- Search Filter Input -->
          <div class="px-6 py-3">
            <div class="relative">
              <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="Elige tu país"
                class="w-full bg-[#111726] border border-white/10 rounded-2xl py-2.5 pl-10 pr-8 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/25 transition-all"
              />
              @if (searchQuery()) {
                <button (click)="searchQuery.set('')" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>
              }
            </div>
          </div>

          <!-- Scrollable Country List -->
          <div class="flex-grow overflow-y-auto px-4 pb-6 space-y-1 custom-scrollbar">
            @for (country of filteredCountries(); track country.code) {
              <button 
                (click)="selectCountry(country.code)"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group active:scale-[0.99]"
                [class]="tmdb.selectedCountry() === country.code ? 'bg-blue-600/20 text-white font-bold border border-blue-500/30' : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'">
                <img [src]="country.flagUrl" [alt]="country.name" loading="lazy" decoding="async" class="w-6 h-4.5 object-cover rounded shadow-sm shrink-0 bg-white/5" />
                <span class="text-sm flex-grow truncate">{{ country.name }}</span>
                @if (tmdb.selectedCountry() === country.code) {
                  <svg class="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                }
              </button>
            } @empty {
              <div class="text-center py-8 text-zinc-500 text-xs">
                No se encontraron países con "{{ searchQuery() }}"
              </div>
            }
          </div>

        </div>
      </div>
    }
  `
})
export class RegionModalComponent {
  tmdb = inject(TmdbService);

  isOpen = input<boolean>(false);
  close = output<void>();
  countrySelected = output<string>();

  searchQuery = signal<string>('');

  currentCountry = computed(() => {
    const code = this.tmdb.selectedCountry();
    return this.tmdb.COUNTRIES.find(c => c.code === code) || null;
  });

  filteredCountries = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.tmdb.COUNTRIES;
    if (!q) return list;
    return list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q)
    );
  });

  selectCountry(code: string): void {
    this.tmdb.setCountry(code);
    this.countrySelected.emit(code);
    this.close.emit();
  }
}
