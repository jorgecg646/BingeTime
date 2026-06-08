import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { TopSeriesComponent } from './components/top-series/top-series.component';
import { YourShowsPageComponent } from './components/your-shows-page/your-shows-page.component';
import { AuthComponent } from './components/auth/auth.component';


export const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: '', component: YourShowsPageComponent },
  { path: 'discover', component: HomeComponent },
  { path: 'top-series', component: TopSeriesComponent },
  { path: '**', redirectTo: '' }
];

