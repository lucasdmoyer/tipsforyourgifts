import { describe, expect, it } from 'vitest';
import { ARTICLE_SUMMARIES } from './generated/content-summary.generated';
import { GIFT_PATHS, giftPathArticles, giftPathUrl } from './gift-paths';

describe('high-intent gift paths', () => {
  it('keeps every path substantial and publication-ready', () => {
    expect(GIFT_PATHS).toHaveLength(3);
    for (const path of GIFT_PATHS) {
      const articles = giftPathArticles(path, ARTICLE_SUMMARIES);
      expect(articles.length, path.id).toBeGreaterThanOrEqual(3);
      expect(articles.every((article) => article.status === 'publication_ready')).toBe(true);
      expect(articles.every((article) => article.productCount > 0)).toBe(true);
      expect(giftPathUrl(path)).toBe(`/gifts/${path.slug}`);
    }
  });

  it('gives each path a meaningfully different article set', () => {
    const sets = GIFT_PATHS.map((path) => giftPathArticles(path, ARTICLE_SUMMARIES).map((article) => article.slug).sort().join('|'));
    expect(new Set(sets).size).toBe(GIFT_PATHS.length);
  });
});
