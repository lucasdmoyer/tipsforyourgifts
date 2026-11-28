import { Routes } from '@angular/router';
import {
  AffiliateDisclosurePage,
  ArticlePage,
  BlogPage,
  FounderBriefPage,
  GiftFinderPage,
  HomePage,
  NotFoundPage,
  StandardsPage,
  StudioPage
} from './pages';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'gift-finder', component: GiftFinderPage },
  { path: 'gifts', loadComponent: () => import('./gift-browse-page').then((page) => page.GiftBrowsePage) },
  { path: 'blog', component: BlogPage },
  { path: 'blog/:slug', component: ArticlePage },
  { path: 'standards', component: StandardsPage },
  { path: 'affiliate-disclosure', component: AffiliateDisclosurePage },
  { path: 'studio', component: StudioPage },
  { path: 'studio/brief', component: FounderBriefPage },
  { path: '**', component: NotFoundPage }
];
