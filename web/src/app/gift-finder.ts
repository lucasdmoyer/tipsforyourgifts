import type { ArticleSummary } from './content.types';

export type RecipientSignal =
  | 'unsure'
  | 'practical_relief'
  | 'maker_pause'
  | 'learning_by_doing'
  | 'look_closer'
  | 'family_story'
  | 'golf_routine';
export type GiftShape = 'either' | 'single' | 'pair';

export interface GiftFinderResult {
  article: ArticleSummary;
  matchReason: string;
}

const RESULT_LIMIT = 4;

const signalKeywords: Record<Exclude<RecipientSignal, 'unsure'>, readonly string[]> = {
  practical_relief: [
    'hard-to-shop', 'useful gifts', 'recipient friction', 'annoyance', 'lose their place',
    'needs the table back', 'wet palette', 'course-day'
  ],
  maker_pause: [
    'knitting', 'crochet', 'miniature', 'acrylic painting', 'puzzle', 'project bag', 'row counter'
  ],
  learning_by_doing: [
    'language learning', 'spanish', 'graded readers', 'books and games', 'books and tools',
    'curious adults', 'read it', 'learning plateau'
  ],
  look_closer: [
    'nature lovers', 'tree identification', 'field guide', 'astronomy', 'stargazing',
    'night sky', 'planisphere'
  ],
  family_story: [
    'family history', 'family stories', 'grandparents', 'photo preservation', 'old photographs'
  ],
  golf_routine: ['golf']
};

function searchableText(article: ArticleSummary) {
  return [article.slug, article.title, article.description, article.audience, ...article.tags].join(' ').toLowerCase();
}

function signalScore(article: ArticleSummary, signal: RecipientSignal) {
  if (signal === 'unsure') return 1;
  const searchable = searchableText(article);
  return signalKeywords[signal].reduce((score, keyword) => score + Number(searchable.includes(keyword)), 0);
}

function matchesShape(article: ArticleSummary, shape: GiftShape) {
  if (shape === 'pair') return article.pairCount > 0;
  if (shape === 'single') return article.productCount > 0;
  return true;
}

function matchReason(article: ArticleSummary, signal: RecipientSignal) {
  if (signal === 'golf_routine') return 'If you know someone who plays golf, start with the wet glove, dirty club, crowded bag, or practice idea they keep working around.';
  if (signal === 'family_story') return 'If you know someone who lights up around old photographs and family stories, give them one gentle way to keep a story with a picture.';
  if (signal === 'look_closer') return 'If you know someone who already stops to notice trees or the night sky, give them one simple tool that helps them look a little closer.';
  if (signal === 'learning_by_doing') return 'If you know someone who learns best by trying, pair an idea they can read with a small way to speak, play, test, or make something.';
  if (signal === 'maker_pause') return 'If you know someone who knits, paints, or puzzles, start with the part of the hobby that gets lost, dries out, or takes over the table when they pause.';
  if (signal === 'practical_relief') return 'If you know someone who keeps tolerating the same small inconvenience, choose the useful upgrade that fixes that one familiar moment.';
  if (article.pairCount > 0) return 'If you know someone who would enjoy two different ways into the same interest, start with the pair whose first shared moment you can picture.';
  return 'If you know someone who postpones the better version because the ordinary one still works, start with the smallest useful upgrade.';
}

export function findGiftGuides(
  articles: readonly ArticleSummary[],
  signal: RecipientSignal,
  shape: GiftShape,
  limit = RESULT_LIMIT
): GiftFinderResult[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Gift finder result limit must be a positive integer');
  return articles
    .filter((article) => article.productCount > 0)
    .filter((article) => signalScore(article, signal) > 0 && matchesShape(article, shape))
    .sort((left, right) =>
      signalScore(right, signal) - signalScore(left, signal) ||
      Number(right.featured) - Number(left.featured) ||
      right.evidenceScore - left.evidenceScore ||
      left.title.localeCompare(right.title)
    )
    .slice(0, limit)
    .map((article) => ({ article, matchReason: matchReason(article, signal) }));
}
