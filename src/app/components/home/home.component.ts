import { Component, inject } from '@angular/core';
import { ShowStateService } from '../../services/show-state.service';
import { TrendingComponent } from '../trending/trending.component';

/**
 * Discovery page with the trending/top-rated shows carousel.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TrendingComponent],
  template: `
    <!-- Trending Section -->
    <app-trending 
      (openDetails)="state.openDetails($event)">
    </app-trending>
  `
})
export class HomeComponent {
  state = inject(ShowStateService);
}
