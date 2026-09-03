import { Component, signal, computed, inject, effect, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute, Router } from '@angular/router';
import { ShowStateService } from './services/show-state.service';
import { TmdbService } from './services/tmdb.service';
import { ShowDetailsModalComponent } from './components/show-details-modal/show-details-modal.component';
import { AuthService } from './services/auth.service';
import { AdsenseComponent } from './components/adsense/adsense.component';
import { RegionModalComponent } from './components/region-modal/region-modal.component';
import { PersonModalComponent } from './components/person-modal/person-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ShowDetailsModalComponent, AdsenseComponent, RegionModalComponent, PersonModalComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  state = inject(ShowStateService);
  tmdb = inject(TmdbService);
  auth = inject(AuthService);
  router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Controls whether the floating navigation bar is visible (hides on scroll down). */
  isNavVisible = signal<boolean>(true);
  /** Whether the user has scrolled past the header area. */
  isScrolled = signal<boolean>(false);
  /** Tracks the previous scroll position to detect scroll direction. */
  private lastScrollTop = 0;

  /**
   * Handles window scroll events to show/hide the navigation bar.
   * Navigation hides when scrolling down and reappears when scrolling up.
   */
  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    this.isScrolled.set(scrollTop > 20);

    if (scrollTop <= 50) {
      this.isNavVisible.set(true);
    } else if (scrollTop > this.lastScrollTop) {
      this.isNavVisible.set(false);
    } else {
      this.isNavVisible.set(true);
    }
    
    this.lastScrollTop = scrollTop;
  }

  /**
   * Derives background slideshow images from the user's watchlist backdrops/posters.
   * Prioritizes high-definition 16:9 backdrops so the background artwork fits full screens
   * naturally without being awkwardly zoomed in or cropped. Falls back to posters or default art.
   */
  bgImages = computed(() => {
    const shows = this.state.watchedShows();
    const defaultImage = 'https://image.tmdb.org/t/p/original/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg';
    if (shows.length === 0) {
      return [defaultImage];
    }
    const images: string[] = [];
    for (const w of shows) {
      // Prioritize 16:9 widescreen backdrop, fallback to poster
      const path = w.show.backdrop_path || w.show.poster_path;
      if (path) {
        images.push(path.replace('/w500/', '/original/').replace('/w780/', '/original/'));
      }
    }
    return images.length > 0 ? images : [defaultImage];
  });

  /** URL of the first background image layer. */
  bgImage1 = signal<string>('');
  /** URL of the second background image layer. */
  bgImage2 = signal<string>('');
  /** Whether the first background layer is currently visible (crossfade toggle). */
  bg1Visible = signal<boolean>(true);
  /** Index of the currently displayed image in the bgImages array. */
  private currentBgIndex = 0;
  /** Interval ID for the background slideshow timer. */
  private bgIntervalId: any;

  constructor() {
    /**
     * Reactive effect that keeps the background in sync when the image list changes.
     * Resets the index if it's out of bounds and initializes images for new lists.
     */
    effect(() => {
      const images = this.bgImages();
      if (this.currentBgIndex >= images.length) {
        this.currentBgIndex = 0;
      }

      if (images.length === 1) {
        this.bgImage1.set(images[0]);
        this.bg1Visible.set(true);
      } else if (images.length > 1 && !this.bgImage1() && !this.bgImage2()) {
        this.bgImage1.set(images[0]);
        this.bg1Visible.set(true);
      }
    });
  }

  /**
   * Initializes the background slideshow, subscribes to URL query params
   * for shareable show links, and triggers the daily new-season check.
   */
  async ngOnInit() {
    // Check if we are handling an external login callback
    const handled = await this.auth.handleExternalLogin();
    if (handled) {
      this.router.navigate(['/']);
    }

    const images = this.bgImages();
    if (images.length > 0) {
      this.bgImage1.set(images[0]);
    }
    this.startBgSlideshow();

    this.route.queryParams.subscribe(params => {
      const showId = params['show'];
      if (showId) {
        this.state.openDetailsById(Number(showId));
      }
    });

    // Check for new episodes in the last 2 weeks (once per day)
    this.state.checkForNewEpisodes();
  }

  /** Cleans up the background slideshow interval on component destruction. */
  ngOnDestroy() {
    if (this.bgIntervalId) {
      clearInterval(this.bgIntervalId);
    }
  }

  /**
   * Starts the background image slideshow that crossfades between
   * two image layers every 10 seconds using the user's watchlist posters.
   */
  private startBgSlideshow() {
    if (this.bgIntervalId) clearInterval(this.bgIntervalId);

    this.bgIntervalId = setInterval(() => {
      const images = this.bgImages();
      if (images.length <= 1) {
        if (images.length === 1) {
          this.bgImage1.set(images[0]);
          this.bg1Visible.set(true);
        }
        return;
      }

      this.currentBgIndex = (this.currentBgIndex + 1) % images.length;
      const nextImg = images[this.currentBgIndex];

      if (this.bg1Visible()) {
        this.bgImage2.set(nextImg);
        this.bg1Visible.set(false);
      } else {
        this.bgImage1.set(nextImg);
        this.bg1Visible.set(true);
      }
    }, 10000);
  }
}
