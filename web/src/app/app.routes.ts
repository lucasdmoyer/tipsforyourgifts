import { Routes } from '@angular/router';
import {
  AffiliateDisclosurePage,
  ArticlePage,
  BlogPage,
  GiftsPage,
  HomePage,
  NotFoundPage,
  StandardsPage,
  StudioPage
} from './pages';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'gifts', component: GiftsPage },
  { path: 'blog', component: BlogPage },
  { path: 'blog/:slug', component: ArticlePage },
  { path: 'standards', component: StandardsPage },
  { path: 'affiliate-disclosure', component: AffiliateDisclosurePage },
  { path: 'studio', component: StudioPage },
  { path: '**', component: NotFoundPage }
];
