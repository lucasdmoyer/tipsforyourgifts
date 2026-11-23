import { describe, expect, it } from 'vitest';
import { loadArticle } from './generated/article-loaders.generated';
import { ARTICLE_SUMMARIES } from './generated/content-summary.generated';
import { findGiftGuides } from './gift-finder';

describe('gift finder', () => {
  it('offers four strong starting points and excludes methodology-only articles', () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'unsure', 'either');
    expect(results).toHaveLength(4);
    expect(results.every(({ article }) => article.status === 'publication_ready' && article.productCount > 0)).toBe(true);
    expect(results.some(({ article }) => article.slug === 'how-we-research-gifts')).toBe(false);
  });

  it('routes a witnessed golf routine only to reviewed golf coverage', () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'golf_routine', 'either');
    expect(results.map(({ article }) => article.slug)).toEqual(['gifts-for-a-golf-friend']);
    expect(results[0].matchReason).toContain('plays golf');
  });

  it('shows only independently reviewed guides with qualified pairs in pair mode', () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'unsure', 'pair');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(4);
    expect(results.every(({ article }) => article.pairCount > 0 && article.researchRun.length > 0)).toBe(true);
  });

  it('routes plain-language clues to the recipient routines they describe', () => {
    expect(findGiftGuides(ARTICLE_SUMMARIES, 'maker_pause', 'either').map(({ article }) => article.slug)).toEqual([
      'knitting-crochet-project-bag-row-counter-gift-pairs',
      'miniature-painting-wet-palette-recipe-pairs',
      'puzzle-board-sorting-tray-gift-pairs'
    ]);
    expect(findGiftGuides(ARTICLE_SUMMARIES, 'look_closer', 'either').map(({ article }) => article.slug)).toEqual([
      'night-sky-planisphere-red-light-gift-pairs',
      'neighborhood-tree-walk-field-guide-loupe-gift-pairs'
    ]);
    expect(findGiftGuides(ARTICLE_SUMMARIES, 'learning_by_doing', 'either').map(({ article }) => article.slug)).toEqual([
      'read-it-then-play-it-gift-pairs',
      'language-learning-gifts-read-a-scene-say-it-aloud'
    ]);
    expect(findGiftGuides(ARTICLE_SUMMARIES, 'family_story', 'either').map(({ article }) => article.slug)).toEqual([
      'one-photo-one-story-gift-pairs'
    ]);
  });

  it('makes every recommendation readable as an if-you-know-someone clue', () => {
    const signals = ['unsure', 'practical_relief', 'maker_pause', 'learning_by_doing', 'look_closer', 'family_story', 'golf_routine'] as const;
    for (const signal of signals) {
      const results = findGiftGuides(ARTICLE_SUMMARIES, signal, 'either');
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(4);
      expect(results.every(({ matchReason }) => matchReason.startsWith('If you know someone'))).toBe(true);
    }
  });

  it('is deterministic even when the catalog arrives in a different order', () => {
    const expected = findGiftGuides(ARTICLE_SUMMARIES, 'practical_relief', 'either').map(({ article }) => article.slug);
    const reversed = findGiftGuides([...ARTICLE_SUMMARIES].reverse(), 'practical_relief', 'either').map(({ article }) => article.slug);
    expect(reversed).toEqual(expected);
  });

  it('keeps listing payloads link-free while route loaders preserve exact article destinations', async () => {
    const results = findGiftGuides(ARTICLE_SUMMARIES, 'practical_relief', 'single');
    expect(JSON.stringify(ARTICLE_SUMMARIES)).not.toContain('contentHtml');
    expect(JSON.stringify(ARTICLE_SUMMARIES)).not.toContain('https://');
    for (const { article: summary } of results) {
      const article = await loadArticle(summary.slug);
      expect(article?.slug).toBe(summary.slug);
      expect(article?.products).toHaveLength(summary.productCount);
      expect(article?.products.every((product) => product.url.startsWith('https://'))).toBe(true);
    }
  });

  it('rejects an invalid result limit', () => {
    expect(() => findGiftGuides(ARTICLE_SUMMARIES, 'unsure', 'either', 0)).toThrow('positive integer');
  });
});
