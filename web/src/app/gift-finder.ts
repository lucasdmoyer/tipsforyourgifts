import type { Article } from './content.types';

export type RecipientSignal = 'unsure' | 'observed_friction' | 'golf_routine' | 'shared_curiosity';
export type GiftShape = 'either' | 'single' | 'pair';

export interface GiftFinderResult {
  article: Article;
  matchReason: string;
}

function matchesSignal(article: Article, signal: RecipientSignal) {
  const searchable = [article.slug, article.title, ...article.tags].join(' ').toLowerCase();
  if (signal === 'unsure') return true;
  if (signal === 'golf_routine') return searchable.includes('golf');
  if (signal === 'shared_curiosity') return article.pairs.length > 0 && /curious|book|history|read|play|experiment|learn|observation/.test(searchable);
  return /friction|hard-to-shop|golf|workaround/.test(searchable);
}

function matchesShape(article: Article, shape: GiftShape) {
  if (shape === 'pair') return article.pairs.length > 0;
  if (shape === 'single') return article.products.length > 0;
  return true;
}

function matchReason(article: Article, signal: RecipientSignal) {
  if (signal === 'golf_routine') return 'Start here when you have witnessed a course-day or golf-bag workaround and want to avoid guessing at performance equipment.';
  if (signal === 'shared_curiosity') return 'Start here when two independently useful gifts could create one activity, discussion, experiment, or repeatable ritual.';
  if (signal === 'observed_friction') return 'Start here when you can name the worn item, improvised fix, repeated complaint, or useful upgrade the recipient keeps postponing.';
  if (article.pairs.length > 0) return 'A reviewed route for recipients whose known interests may support a compatible, independently useful pair.';
  return 'A reviewed route for turning a recipient clue into a smaller, more defensible buying decision.';
}

export function findGiftGuides(articles: readonly Article[], signal: RecipientSignal, shape: GiftShape): GiftFinderResult[] {
  return articles
    .filter((article) => article.products.length > 0)
    .filter((article) => matchesSignal(article, signal) && matchesShape(article, shape))
    .sort((left, right) => right.evidenceScore - left.evidenceScore || left.title.localeCompare(right.title))
    .map((article) => ({ article, matchReason: matchReason(article, signal) }));
}
