import { ActivatedRouteSnapshot, Routes } from '@angular/router';

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
  { path: 'gift-finder', loadComponent: () => import('./gift-finder-page').then(({ GiftFinderPage }) => GiftFinderPage) },
  { path: 'gifts/curious-adults', loadComponent: giftPathPage, data: { giftPath: 'curious-adults' } },
  { path: 'gifts/hobby-lovers', loadComponent: giftPathPage, data: { giftPath: 'hobby-lovers' } },
  { path: 'gifts/thoughtful-pairs', loadComponent: giftPathPage, data: { giftPath: 'thoughtful-pairs' } },
  { path: 'gifts', loadComponent: () => import('./gifts-page').then(({ GiftsPage }) => GiftsPage) },
  { path: 'blog', loadComponent: () => import('./blog-page').then(({ BlogPage }) => BlogPage) },
  { path: 'blog/:slug', loadComponent: () => import('./article-page').then(({ ArticlePage }) => ArticlePage), resolve: { article: articleData } },
  { path: 'standards', loadComponent: () => import('./standards-page').then(({ StandardsPage }) => StandardsPage) },
  { path: 'affiliate-disclosure', loadComponent: () => import('./affiliate-disclosure-page').then(({ AffiliateDisclosurePage }) => AffiliateDisclosurePage) },
  { path: 'studio', loadComponent: studioPage('StudioPage'), resolve: { studioData } },
  { path: 'studio/decisions', loadComponent: () => import('./decision-inbox-page').then(({ DecisionInboxPage }) => DecisionInboxPage), resolve: { studioData } },
  { path: 'studio/brief', loadComponent: studioPage('FounderBriefPage') },
  { path: '**', loadComponent: () => import('./not-found-page').then(({ NotFoundPage }) => NotFoundPage) }
];
