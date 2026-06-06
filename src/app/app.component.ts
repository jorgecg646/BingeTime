import { Component, signal, computed, inject, effect, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { ShowStateService } from './services/show-state.service';
import { ShowDetailsModalComponent } from './components/show-details-modal/show-details-modal.component';
import { SearchComponent } from './components/search/search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ShowDetailsModalComponent, SearchComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  state = inject(ShowStateService);
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
    
    this.isScrolled.set(scrollTop > 250);

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
   * Derives background slideshow images from the user's watchlist posters.
   * Falls back to a default image when the watchlist is empty.
   */
  bgImages = computed(() => {
    const shows = this.state.watchedShows();
    const defaultImage = 'https://static.tvmaze.com/uploads/images/original_untouched/501/1253519.jpg';
    if (shows.length === 0) {
      return [defaultImage];
    }
    return shows
      .map(w => w.show.poster_path)
      .filter((path): path is string => !!path)
      .map(path => path.replace('medium_portrait', 'original_untouched'));
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
  ngOnInit() {
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

    // Check for new seasons in background (once per day)
    this.state.checkForNewSeasons();
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
