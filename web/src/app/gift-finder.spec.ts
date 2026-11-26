import { describe, expect, it } from 'vitest';
import { loadArticle } from './generated/article-loaders.generated';
import { ARTICLE_SUMMARIES } from './generated/content-summary.generated';
import { findGiftGuides } from './gift-finder';

describe('gift finder', () => {
  it('starts with every publication-ready buying guide and excludes methodology-only articles', () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'unsure', 'either');
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every(({ article }) => article.status === 'publication_ready' && article.productCount > 0)).toBe(true);
    expect(results.some(({ article }) => article.slug === 'how-we-research-gifts')).toBe(false);
  });

  it('routes a witnessed golf routine only to reviewed golf coverage', () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'golf_routine', 'either');
    expect(results.map(({ article }) => article.slug)).toEqual(['gifts-for-a-golf-friend']);
    expect(results[0].matchReason).toContain('witnessed');
  });

  it('shows only independently reviewed guides with qualified pairs in pair mode', () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'unsure', 'pair');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(({ article }) => article.pairCount > 0 && article.researchRun.length > 0)).toBe(true);
  });

  it('routes a shared-curiosity clue to every reviewed book-and-action guide', () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'shared_curiosity', 'pair');
    const slugs = results.map(({ article }) => article.slug);
    expect(slugs).toEqual(expect.arrayContaining([
      'one-photo-one-story-gift-pairs',
      'read-it-then-play-it-gift-pairs',
      'language-learning-gifts-read-a-scene-say-it-aloud',
      'miniature-painting-wet-palette-recipe-pairs',
      'neighborhood-tree-walk-field-guide-loupe-gift-pairs',
      'night-sky-planisphere-red-light-gift-pairs',
      'puzzle-board-sorting-tray-gift-pairs',
    ]));
    expect(slugs).not.toContain('gifts-for-a-golf-friend');
  });

  it('keeps listing payloads link-free while route loaders preserve exact article destinations', async () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'observed_friction', 'single');
    expect(JSON.stringify(ARTICLE_SUMMARIES)).not.toContain('contentHtml');
    expect(JSON.stringify(ARTICLE_SUMMARIES)).not.toContain('https://');
    for (const { article: summary } of results) {
      const article = await loadArticle(summary.slug);
      expect(article?.slug).toBe(summary.slug);
      expect(article?.products).toHaveLength(summary.productCount);
      expect(article?.products.every((product) => product.url.startsWith('https://'))).toBe(true);
    }
  });
});
