import type { Article } from './content.types';

const INTERNAL_SECTION_PATTERN = /<h2>(?:Every finalist has to earn its place|Four pairs we rejected|Four pairs we left out|What did not qualify|What the research rejected|What we left out)<\/h2>[\s\S]*?(?=<h2>|$)/gi;

export function readerLanguage(value: string) {
  return value;
}

function readerArticleHtml(value: string, includePreamble = false) {
  const firstSection = value.indexOf('<h2>');
  const withoutPreamble = includePreamble || firstSection < 0 ? value : value.slice(firstSection);
  return withoutPreamble.replace(INTERNAL_SECTION_PATTERN, '');
}

function compactReadAndPlayHtml(value: string) {
  const explicitBoundary = value.indexOf('<!-- reader-details -->');
  const firstPair = value.search(/<h2>1\./i);
  const firstHeading = value.indexOf('<h2>');
  const selectionListEnd = firstHeading >= 0 ? value.indexOf('</ol>', firstHeading) : -1;
  const introductionEnd = explicitBoundary >= 0
    ? explicitBoundary
    : firstPair >= 0
    ? firstPair
    : selectionListEnd >= 0
      ? selectionListEnd + '</ol>'.length
      : firstHeading >= 0
        ? firstHeading
        : value.length;
  const introduction = value.slice(0, introductionEnd);
  const withHeading = /<h2>What this (?:kind of )?gift actually is<\/h2>/i.test(introduction)
    ? introduction
    : `<h2>What this kind of gift actually is</h2>${introduction}`;
  return withHeading.replace(INTERNAL_SECTION_PATTERN, '');
}

export function readerDescription(article: Article) {
  return article.description;
}

export function readerTitle(article: Article) {
  return article.title;
}

export function readerGiftIdea(article: Article) {
  return article.readerIntro?.giftIdea ?? 'Give them something that proves you noticed.';
}

export function readerLead(article: Article) {
  return article.readerIntro?.lead ?? `If you know someone who likes ${article.audience}, start with what they already enjoy.`;
}

export function readerTags(article: Article) {
  if (article.slug === 'how-we-research-gifts') return ['thoughtful gifts', 'gift ideas', 'how to choose'];
  return article.tags;
}

export function readerBodyHtml(article: Article) {
  if (article.slug === 'read-it-then-play-it-gift-pairs') return compactReadAndPlayHtml(article.contentHtml);
  return readerArticleHtml(article.contentHtml, article.readerIntro?.bodyPlacement === 'before-products');
}

export function readerBodyComesFirst(article: Article) {
  return article.readerIntro?.bodyPlacement === 'before-products';
}

export function readerEvidenceHtml(article: Article) {
  if (article.slug !== 'read-it-then-play-it-gift-pairs') return '';
  const articleWithoutInternalSections = article.contentHtml.replace(INTERNAL_SECTION_PATTERN, '');
  const productUrls = new Set(article.products.map((product) => product.url.replaceAll('&amp;', '&')));
  const seen = new Set<string>();
  const sourceLinks: string[] = [];
  for (const match of articleWithoutInternalSections.matchAll(/<a\b[^>]*\bhref=(['"])(https:[^'"]+)\1[^>]*>[\s\S]*?<\/a>/gi)) {
    const normalizedHref = match[2].replaceAll('&amp;', '&');
    if (productUrls.has(normalizedHref) || seen.has(normalizedHref)) continue;
    seen.add(normalizedHref);
    const link = match[0].replace(/^<a\b[^>]*>/i, (openingTag) => {
      const cleanOpeningTag = openingTag
        .replace(/\s+target=(['"])[\s\S]*?\1/gi, '')
        .replace(/\s+rel=(['"])[\s\S]*?\1/gi, '');
      return cleanOpeningTag.replace(/^<a\b/i, '<a target="_blank" rel="noopener"');
    });
    sourceLinks.push(link);
  }
  if (sourceLinks.length === 0) return '';
  return `<h2>Sources behind the pairings</h2><p>These links support the product details, tradeoffs, and compatibility checks used in the guide.</p><ul>${sourceLinks.map((link) => `<li>${link}</li>`).join('')}</ul>`;
}
