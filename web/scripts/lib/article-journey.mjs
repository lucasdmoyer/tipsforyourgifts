const DEFAULT_LIMIT = 3;

function matchesGiftPath(article, path) {
  const matching = path.matching;
  if (matching.type === 'minimum_pair_count') return article.pairs.length >= matching.value;
  const tags = new Set(matching.values);
  return article.tags.some((tag) => tags.has(tag));
}

function primaryGiftPath(article, giftPaths) {
  const matches = giftPaths.filter((path) => matchesGiftPath(article, path));
  return matches.find((path) => path.matching.type !== 'minimum_pair_count') ?? matches[0] ?? null;
}

function sharedTagCount(left, right) {
  const rightTags = new Set(right.tags);
  return left.tags.filter((tag) => rightTags.has(tag)).length;
}

function relatedScore(article, candidate, articlePath, candidatePath) {
  return (articlePath && candidatePath?.id === articlePath.id ? 100 : 0)
    + sharedTagCount(article, candidate) * 10
    + (candidate.featured ? 3 : 0)
    + (candidate.pairs.length > 0 ? 2 : 0);
}

function relatedGuide(candidate) {
  return {
    slug: candidate.slug,
    title: candidate.title,
    description: candidate.description,
    occasion: candidate.occasion,
    priceBand: candidate.priceBand,
    visual: { hero: candidate.visual.hero }
  };
}

export function buildArticleJourneys(articles, giftPaths, limit = DEFAULT_LIMIT) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('article journey limit must be a positive integer');
  const pathsByArticle = new Map(articles.map((article) => [article.slug, primaryGiftPath(article, giftPaths)]));
  const eligibleGuides = articles.filter((article) => article.products.length > 0);
  if (eligibleGuides.length <= limit) throw new Error(`article journeys need at least ${limit + 1} publication-ready product guides`);

  return Object.fromEntries(articles.map((article) => {
    const articlePath = pathsByArticle.get(article.slug);
    const candidates = eligibleGuides
      .filter((candidate) => candidate.slug !== article.slug)
      .map((candidate) => ({
        article: candidate,
        score: relatedScore(article, candidate, articlePath, pathsByArticle.get(candidate.slug))
      }))
      .sort((left, right) => right.score - left.score
        || right.article.updatedDate.localeCompare(left.article.updatedDate)
        || left.article.slug.localeCompare(right.article.slug))
      .slice(0, limit)
      .map(({ article: candidate }) => relatedGuide(candidate));

    if (candidates.length !== limit) throw new Error(`${article.slug}: expected ${limit} related guides, found ${candidates.length}`);
    return [article.slug, {
      path: articlePath ? {
        slug: articlePath.slug,
        title: articlePath.title,
        description: articlePath.description
      } : null,
      guides: candidates
    }];
  }));
}
