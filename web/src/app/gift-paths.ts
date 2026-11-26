import type { ArticleSummary } from './content.types';
import { GIFT_PATHS } from './generated/gift-paths.generated';

export type GiftPath = (typeof GIFT_PATHS)[number];

export function giftPathUrl(path: GiftPath) {
  return `/gifts/${path.slug}`;
}

export function findGiftPath(id: string | null | undefined) {
  return GIFT_PATHS.find((path) => path.id === id);
}

export function giftPathArticles(path: GiftPath, articles: readonly ArticleSummary[]) {
  const matching = path.matching;
  if (matching.type === 'minimum_pair_count') {
    return articles.filter((article) => article.pairCount >= matching.value);
  }
  const tags = new Set<string>(matching.values);
  return articles.filter((article) => article.tags.some((tag) => tags.has(tag)));
}

export { GIFT_PATHS };
