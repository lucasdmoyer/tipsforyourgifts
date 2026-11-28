import type { Article, Product } from './content.types';

export const giftBudgets = [
  { value: '25', label: '$25 or less' },
  { value: '50', label: '$50 or less' },
  { value: '75', label: '$75 or less' },
  { value: '100', label: '$100 or less' },
  { value: '150', label: '$150 or less' },
] as const;

export const giftTopics = [
  { value: 'outdoors', label: 'Outdoors & nature' },
  { value: 'games', label: 'Games & puzzles' },
  { value: 'books', label: 'Books & learning' },
  { value: 'crafts', label: 'Arts & crafts' },
  { value: 'sports', label: 'Sports & golf' },
  { value: 'family', label: 'Family & keepsakes' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'practical', label: 'Practical & travel' },
] as const;

export const giftRecipients = [
  { value: 'husband', label: 'Husband' },
  { value: 'wife', label: 'Wife' },
  { value: 'mom', label: 'Mom' },
  { value: 'dad', label: 'Dad' },
  { value: 'niece', label: 'Niece' },
  { value: 'nephew', label: 'Nephew' },
  { value: 'kids', label: 'Kids' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'friend', label: 'Friend' },
] as const;

type Budget = (typeof giftBudgets)[number]['value'];
type Topic = (typeof giftTopics)[number]['value'];
type Recipient = (typeof giftRecipients)[number]['value'];
type Audience = 'partner' | 'parent' | 'niece-nephew' | 'grandparent' | 'friend';

export interface GiftBrowseFilters {
  budget: Budget | '';
  topic: Topic | '';
  for: Recipient | '';
}

export const emptyGiftBrowseFilters: GiftBrowseFilters = { budget: '', topic: '', for: '' };

type BrowseRule = {
  topics?: readonly Topic[];
  productTopics?: Readonly<Record<string, readonly Topic[]>>;
  sharedWithKids?: readonly string[];
  audiences: readonly Audience[];
};

const adultAudience: Record<Exclude<Recipient, 'kids'>, Audience> = {
  husband: 'partner', wife: 'partner', mom: 'parent', dad: 'parent',
  niece: 'niece-nephew', nephew: 'niece-nephew', grandparent: 'grandparent', friend: 'friend',
};

// Relationships are starting points, not assumptions about taste. Spouses
// and parents share categories. For kids, only specific shared activities match.
export const browseRules: Readonly<Record<string, BrowseRule>> = {
  'gifts-for-a-golf-friend': { topics: ['sports', 'outdoors'], audiences: ['partner', 'parent', 'friend'] },
  'language-learning-gifts-read-a-scene-say-it-aloud': {
    topics: ['books'], audiences: ['partner', 'niece-nephew', 'friend'],
    productTopics: { 'rory-story-cubes-eco-blister': ['games'], 'dixit-2021-refresh': ['games'] },
  },
  'miniature-painting-wet-palette-recipe-pairs': { topics: ['crafts'], audiences: ['partner', 'niece-nephew', 'friend'] },
  'neighborhood-tree-walk-field-guide-loupe-gift-pairs': {
    topics: ['outdoors'], audiences: ['partner', 'parent', 'niece-nephew', 'grandparent', 'friend'],
    productTopics: {
      'peterson-eastern-trees': ['books'], 'princeton-eastern-north-america': ['books'],
      'sibley-guide-to-trees': ['books'], 'audubon-trees-north-america': ['books'],
    },
  },
  'night-sky-planisphere-red-light-gift-pairs': {
    topics: ['outdoors'], audiences: ['partner', 'parent', 'niece-nephew', 'grandparent', 'friend'],
  },
  'one-photo-one-story-gift-pairs': { topics: ['family'], audiences: ['parent', 'grandparent'] },
  'puzzle-board-sorting-tray-gift-pairs': { topics: ['games'], audiences: ['partner', 'parent', 'grandparent', 'friend'] },
  'read-it-then-play-it-gift-pairs': {
    audiences: ['partner', 'parent', 'niece-nephew', 'friend'],
    productTopics: {
      'sapiens-us-paperback': ['books'], 'civilization-vi-windows-steam': ['games'],
      'genius-of-birds-paperback': ['books', 'outdoors'], 'wingspan-digital-steam': ['games'],
      'a-city-on-mars-paperback': ['books'], 'terraforming-mars-ares-expedition': ['games'],
      'thinking-in-systems-paperback': ['books'], 'pandemic-base-game': ['games'],
      'because-internet-paperback': ['books'], 'codenames-2025-english': ['games'],
      'leave-only-footprints-paperback': ['books', 'outdoors'], 'trekking-national-parks-third-edition': ['games'],
      'steering-the-craft-2015': ['books', 'crafts'], 'rorys-story-cubes-classic': ['games', 'crafts'],
      'read-this-great-photographs-2023': ['books', 'crafts'], '52-assignments-street-photography': ['books', 'crafts'],
      'entangled-life-paperback': ['books', 'outdoors'], 'undergrove-base-game': ['games'],
      'the-food-lab-hardcover': ['books', 'cooking'], 'temppro-tp19h': ['cooking'],
    },
  },
  'useful-gifts-for-hard-to-shop-for-adults': {
    topics: ['practical'], audiences: ['partner', 'parent', 'friend'],
    productTopics: { 'thermoworks-thermopop-2': ['cooking'], 'fenix-e12-v3': ['outdoors'] },
  },
};

function knownValue<T extends string>(options: readonly { value: T }[], value: string | null): T | '' {
  return options.find((option) => option.value === value)?.value ?? '';
}

export function readGiftBrowseFilters(query: { get(name: string): string | null }): GiftBrowseFilters {
  return {
    budget: knownValue(giftBudgets, query.get('budget')),
    topic: knownValue(giftTopics, query.get('topic')),
    for: knownValue(giftRecipients, query.get('for')),
  };
}

// Deliberately use the high end of a whole documented item band. A $25–$70
// item is not a $50 match. Missing or ambiguous prices never qualify by budget.
export function softPriceCeiling(band: string | undefined): number | null {
  const match = band?.trim().match(/^(?:under\s+|\$(\d+(?:\.\d{2})?)\s*[-–—]\s*)?\$(\d+(?:\.\d{2})?)$/i);
  if (!match) return null;
  const amount = Number(match[2]);
  return Number.isFinite(amount) && amount > 0 && (!match[1] || Number(match[1]) <= amount) ? amount : null;
}

export function topicsForGift(article: Article, product: Product): readonly Topic[] {
  const rule = browseRules[article.slug];
  return [...new Set([...(rule?.topics ?? []), ...(rule?.productTopics?.[product.id] ?? [])])];
}

export function browseTopicsForArticle(article: Article) {
  const applicable = new Set(article.products.flatMap((product) => topicsForGift(article, product)));
  return giftTopics.filter((topic) => applicable.has(topic.value));
}

export interface GiftBrowseResult {
  article: Article;
  picks: { product: Product; fragment: string }[];
  topics: readonly Topic[];
}

export function browseGiftGuides(articles: readonly Article[], filters: GiftBrowseFilters): GiftBrowseResult[] {
  const cap = filters.budget ? Number(filters.budget) : undefined;
  return articles.flatMap((article) => {
    if (article.status !== 'publication_ready') return [];
    const rule = browseRules[article.slug];
    if (filters.for && filters.for !== 'kids' && !rule?.audiences.includes(adultAudience[filters.for])) return [];
    const matching = article.products.filter((product) => {
      if (filters.for === 'kids' && !rule?.sharedWithKids?.includes(product.id)) return false;
      if (filters.topic && !topicsForGift(article, product).includes(filters.topic)) return false;
      const ceiling = softPriceCeiling(product.priceBand);
      return cap === undefined || (ceiling !== null && ceiling <= cap);
    });
    if (!matching.length) return [];
    return [{
      article,
      picks: matching.map((product) => ({
        product,
        fragment: article.pairs.find((pair) => pair.anchorProductId === product.id || pair.companionProductId === product.id)?.id ?? product.id,
      })),
      topics: [...new Set(matching.flatMap((product) => topicsForGift(article, product)))],
    }];
  });
}
