import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { ARTICLE_SLUGS } from './generated/article-loaders.generated';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.None,
    async getPrerenderParams() {
      return ARTICLE_SLUGS.map((slug) => ({ slug }));
    }
  },
  { path: '**', renderMode: RenderMode.Prerender }
];
