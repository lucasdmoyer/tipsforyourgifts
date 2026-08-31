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
  if (signal === 'shared_curiosity') {
    return article.pairs.length > 0 && !searchable.includes('golf') &&
      /curious|book|history|read|play|experiment|learn|observation|language|paint|photo|story|tree|nature|sky|astronomy|stargaz|puzzle/.test(searchable);
  }
  return /friction|hard-to-shop|golf|workaround|palette|paint|puzzle|storage/.test(searchable);
}

function matchesShape(article: Article, shape: GiftShape) {
  if (shape === 'pair') return article.pairs.length > 0;
  if (shape === 'single') return article.products.length > 0;
  return true;
}

function matchReason(article: Article, signal: RecipientSignal) {
  if (signal === 'golf_routine') return 'Start here when you have witnessed the wet glove, dirty club, overstuffed bag, or other course-day annoyance they keep tolerating.';
  if (signal === 'shared_curiosity') return 'Start here when one interest could become an activity, a conversation, an experiment, or a ritual you share.';
  if (signal === 'observed_friction') return 'Start here when you can name the worn item, improvised fix, repeated complaint, or nicer version they keep postponing.';
  if (article.pairs.length > 0) return 'Start here when two different gifts could create one moment they will remember.';
  return 'Start here when a small, useful upgrade would tell them you have been paying attention.';
}

export function findGiftGuides(articles: readonly Article[], signal: RecipientSignal, shape: GiftShape): GiftFinderResult[] {
  return articles
    .filter((article) => article.products.length > 0)
    .filter((article) => matchesSignal(article, signal) && matchesShape(article, shape))
    .sort((left, right) => right.evidenceScore - left.evidenceScore || left.title.localeCompare(right.title))
    .map((article) => ({ article, matchReason: matchReason(article, signal) }));
}
