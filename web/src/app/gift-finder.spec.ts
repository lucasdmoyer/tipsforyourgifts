import { describe, expect, it } from 'vitest';
import { ARTICLES } from './generated/content.generated';
import { findGiftGuides } from './gift-finder';

describe('gift finder', () => {
  it('starts with every publication-ready buying guide and excludes methodology-only articles', () => {
    const results = findGiftGuides(ARTICLES, 'unsure', 'either');
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every(({ article }) => article.status === 'publication_ready' && article.products.length > 0)).toBe(true);
    expect(results.some(({ article }) => article.slug === 'how-we-research-gifts')).toBe(false);
  });

  it('routes a witnessed golf routine only to reviewed golf coverage', () => {
    const results = findGiftGuides(ARTICLES, 'golf_routine', 'either');
    expect(results.map(({ article }) => article.slug)).toEqual(['gifts-for-a-golf-friend']);
    expect(results[0].matchReason).toContain('witnessed');
  });

  it('shows only independently reviewed guides with qualified pairs in pair mode', () => {
    const results = findGiftGuides(ARTICLES, 'unsure', 'pair');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(({ article }) => article.pairs.length > 0 && article.researchRun.length > 0)).toBe(true);
  });

  it('keeps a shared-curiosity clue on the researched book-and-action route', () => {
    const results = findGiftGuides(ARTICLES, 'shared_curiosity', 'pair');
    expect(results.map(({ article }) => article.slug)).toEqual(['read-it-then-play-it-gift-pairs']);
  });

  it('preserves source article and merchant destinations without creating new links', () => {
    const results = findGiftGuides(ARTICLES, 'observed_friction', 'single');
    for (const { article } of results) {
      const source = ARTICLES.find((candidate) => candidate.slug === article.slug);
      expect(article).toBe(source);
      expect(article.products.map((product) => product.url)).toEqual(source?.products.map((product) => product.url));
    }
  });
});
