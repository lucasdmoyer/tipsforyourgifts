import assert from 'node:assert/strict';
import { buildArticleJourneys } from './lib/article-journey.mjs';

const hero = { id: 'hero', src: '/hero.webp', alt: 'Illustration', caption: 'Caption' };
const article = (slug, tags, { pairs = 1, featured = false, products = 1 } = {}) => ({
  slug,
  title: `Guide ${slug}`,
  description: `Description ${slug}`,
  occasion: 'Birthday',
  priceBand: '$20-$50',
  tags,
  featured,
  updatedDate: `2026-11-${String(slug.length + 10).padStart(2, '0')}T00:00:00.000Z`,
  products: Array.from({ length: products }, (_, index) => ({ id: `${slug}-${index}` })),
  pairs: Array.from({ length: pairs }, (_, index) => ({ id: `${slug}-pair-${index}` })),
  visual: { hero }
});

const paths = [
  { id: 'curious', slug: 'curious', title: 'Curious people', description: 'Curiosity guides', matching: { type: 'any_tag', values: ['curious'] } },
  { id: 'hobby', slug: 'hobby', title: 'Hobby people', description: 'Hobby guides', matching: { type: 'any_tag', values: ['hobby'] } },
  { id: 'pairs', slug: 'pairs', title: 'Gift pairs', description: 'Pair guides', matching: { type: 'minimum_pair_count', value: 1 } }
];
const articles = [
  article('curious-a', ['curious', 'pair']),
  article('curious-b', ['curious', 'pair']),
  article('curious-c', ['curious']),
  article('curious-d', ['curious']),
  article('hobby-a', ['hobby', 'pair'], { featured: true }),
  article('hobby-b', ['hobby']),
  article('hobby-c', ['hobby']),
  article('hobby-d', ['hobby']),
  article('philosophy', ['thoughtful'], { pairs: 0, products: 0 })
];

const journeys = buildArticleJourneys(articles, paths);
assert.equal(journeys['curious-a'].path.slug, 'curious', 'specific recipient path should win over the broad pair path');
assert.deepEqual(new Set(journeys['curious-a'].guides.map((guide) => guide.slug)), new Set(['curious-b', 'curious-c', 'curious-d']));
assert.equal(journeys['hobby-a'].guides.length, 3);
assert.ok(journeys['hobby-a'].guides.every((guide) => guide.slug.startsWith('hobby-')), 'related guides should stay in the primary recipient path when coverage exists');
assert.equal(journeys.philosophy.path, null);
assert.equal(journeys.philosophy.guides.length, 3, 'unclassified editorial pages should receive a deterministic product-guide fallback');
assert.ok(!journeys.philosophy.guides.some((guide) => guide.slug === 'philosophy'));

console.log(JSON.stringify({ articleJourneyTests: 'passed', articles: articles.length, guidesPerArticle: 3 }, null, 2));
