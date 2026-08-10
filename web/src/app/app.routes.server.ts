import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { ARTICLES } from './generated/content.generated';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.None,
    async getPrerenderParams() {
      return ARTICLES
        .filter((article) => article.status === 'publication_ready')
        .map((article) => ({ slug: article.slug }));
    }
  },
  { path: '**', renderMode: RenderMode.Prerender }
];
