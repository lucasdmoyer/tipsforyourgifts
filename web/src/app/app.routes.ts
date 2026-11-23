import { ActivatedRouteSnapshot, Routes } from '@angular/router';

const page = <T extends keyof typeof import('./public-pages')>(name: T) =>
  () => import('./public-pages').then((pages) => pages[name]);

const studioPage = <T extends keyof typeof import('./studio-pages')>(name: T) =>
  () => import('./studio-pages').then((pages) => pages[name]);

const giftPathPage = () => import('./gift-path-page').then(({ GiftPathPage }) => GiftPathPage);

const studioData = () => import('./generated/studio.generated').then(({ OPERATIONS, STRATEGY, GROWTH }) => ({
  operations: OPERATIONS,
  strategy: STRATEGY,
  growth: GROWTH
}));

const articleData = (route: ActivatedRouteSnapshot) =>
  import('./generated/article-loaders.generated').then(({ loadArticle }) => loadArticle(route.paramMap.get('slug')));

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home-page').then(({ HomePage }) => HomePage) },
  { path: 'gift-finder', loadComponent: page('GiftFinderPage') },
  { path: 'gifts/curious-adults', loadComponent: giftPathPage, data: { giftPath: 'curious-adults' } },
  { path: 'gifts/hobby-lovers', loadComponent: giftPathPage, data: { giftPath: 'hobby-lovers' } },
  { path: 'gifts/thoughtful-pairs', loadComponent: giftPathPage, data: { giftPath: 'thoughtful-pairs' } },
  { path: 'gifts', loadComponent: page('GiftsPage') },
  { path: 'blog', loadComponent: page('BlogPage') },
  { path: 'blog/:slug', loadComponent: () => import('./article-page').then(({ ArticlePage }) => ArticlePage), resolve: { article: articleData } },
  { path: 'standards', loadComponent: page('StandardsPage') },
  { path: 'affiliate-disclosure', loadComponent: page('AffiliateDisclosurePage') },
  { path: 'studio', loadComponent: studioPage('StudioPage'), resolve: { studioData } },
  { path: 'studio/decisions', loadComponent: () => import('./decision-inbox-page').then(({ DecisionInboxPage }) => DecisionInboxPage), resolve: { studioData } },
  { path: 'studio/brief', loadComponent: studioPage('FounderBriefPage') },
  { path: '**', loadComponent: page('NotFoundPage') }
];
