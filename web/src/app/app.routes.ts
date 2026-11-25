import { Routes } from '@angular/router';

const page = <T extends keyof typeof import('./pages')>(name: T) =>
  () => import('./pages').then((pages) => pages[name]);

const studioData = () => import('./generated/studio.generated').then(({ OPERATIONS, STRATEGY, GROWTH }) => ({
  operations: OPERATIONS,
  strategy: STRATEGY,
  growth: GROWTH
}));

export const routes: Routes = [
  { path: '', loadComponent: page('HomePage') },
  { path: 'gift-finder', loadComponent: page('GiftFinderPage') },
  { path: 'gifts', loadComponent: page('GiftsPage') },
  { path: 'blog', loadComponent: page('BlogPage') },
  { path: 'blog/:slug', loadComponent: page('ArticlePage') },
  { path: 'standards', loadComponent: page('StandardsPage') },
  { path: 'affiliate-disclosure', loadComponent: page('AffiliateDisclosurePage') },
  { path: 'studio', loadComponent: page('StudioPage'), resolve: { studioData } },
  { path: 'studio/brief', loadComponent: page('FounderBriefPage') },
  { path: '**', loadComponent: page('NotFoundPage') }
];
