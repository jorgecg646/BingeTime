import { Routes } from '@angular/router';
import { guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { 
    path: 'auth', 
    loadComponent: () => import('./components/auth/auth.component').then(m => m.AuthComponent), 
    canActivate: [guestGuard] 
  },
  { 
    path: '', 
    loadComponent: () => import('./components/your-shows-page/your-shows-page.component').then(m => m.YourShowsPageComponent) 
  },
  { 
    path: 'discover', 
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent) 
  },
  { 
    path: 'top-series', 
    loadComponent: () => import('./components/top-series/top-series.component').then(m => m.TopSeriesComponent) 
  },
  { 
    path: 'calendar', 
    loadComponent: () => import('./components/calendar/calendar.component').then(m => m.CalendarComponent) 
  },
  { 
    path: 'stats', 
    loadComponent: () => import('./components/stats-wrapped/stats-wrapped.component').then(m => m.StatsWrappedComponent) 
  },
  { path: 'wrapped', redirectTo: 'stats' },
  { path: '**', redirectTo: '' }
];
