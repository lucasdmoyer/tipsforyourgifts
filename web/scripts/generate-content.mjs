import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { marked } from 'marked';
import { applyAffiliateLinkOverlays, loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';

const root = process.cwd();
const blogDir = path.join(root, 'src', 'data', 'blog');
const generatedDir = path.join(root, 'src', 'app', 'generated');
const publicOutputPath = path.join(generatedDir, 'content.generated.ts');
const publicSummaryOutputPath = path.join(generatedDir, 'content-summary.generated.ts');
const articleLoaderOutputPath = path.join(generatedDir, 'article-loaders.generated.ts');
const articleModuleDir = path.join(generatedDir, 'articles');
const studioOutputPath = path.join(generatedDir, 'studio.generated.ts');
const strategyPath = path.join(root, 'src', 'data', 'strategy.json');
const operationsPath = path.join(root, 'src', 'data', 'operations.json');
const growthPath = path.join(root, 'src', 'data', 'growth.json');
const visualsPath = path.join(root, 'visuals', 'article-visuals.json');
const sitemapPath = path.join(root, 'public', 'sitemap.xml');
const rssPath = path.join(root, 'public', 'rss.xml');
const affiliateLinkState = await loadAffiliateLinkState(root);
const visualRegistry = JSON.parse(await fs.readFile(visualsPath, 'utf8'));
const visualAssets = new Map(
  visualRegistry.assets.map((asset) => [
    asset.id,
    {
      id: asset.id,
      src: asset.src,
      alt: asset.alt,
      caption: asset.caption,
    },
  ]),
);
const articleVisuals = new Map(visualRegistry.articles.map((entry) => [entry.slug, entry]));

marked.use({ gfm: true, async: false });

const fileNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md')).sort();
const articles = [];
for (const fileName of fileNames) {
  const slug = path.basename(fileName, '.md');
  const parsed = matter(await fs.readFile(path.join(blogDir, fileName), 'utf8'));
  const data = parsed.data;
  const products = data.products ?? [];
  const pairs = data.pairs ?? [];
  const visualEntry = articleVisuals.get(slug);
  if (!visualEntry) throw new Error(`No visual mapping exists for article ${slug}`);
  const hero = visualAssets.get(visualEntry.heroId);
  if (!hero) throw new Error(`Article ${slug} references unknown hero visual ${visualEntry.heroId}`);
  const resolvedPairSceneIds = Object.fromEntries(pairs.map((pair) => [pair.id, visualEntry.pairSceneIds?.[pair.id] ?? visualEntry.heroId]));
  const resolvedProductSceneIds = Object.fromEntries(products.map((product) => {
    const pair = pairs.find((candidate) => candidate.anchorProductId === product.id || candidate.companionProductId === product.id);
    return [product.id, (pair && resolvedPairSceneIds[pair.id]) || visualEntry.heroId];
  }));
  const sceneIds = [...new Set([visualEntry.heroId, ...Object.values(resolvedPairSceneIds), ...Object.values(resolvedProductSceneIds)])];
  const scenes = sceneIds.map((id) => {
    const asset = visualAssets.get(id);
    if (!asset) throw new Error(`Article ${slug} resolves to unknown visual ${id}`);
    return asset;
  });
  const article = {
    slug,
    title: data.title,
    description: data.description,
    publishDate: new Date(data.publishDate).toISOString(),
    updatedDate: new Date(data.updatedDate ?? data.publishDate).toISOString(),
    status: data.status,
    audience: data.audience,
    occasion: data.occasion,
    priceBand: data.priceBand,
    tags: data.tags ?? [],
    researchRun: data.researchRun,
    evidenceScore: Number(data.evidenceScore),
    evidenceMode: data.evidenceMode,
    featured: Boolean(data.featured),
    affiliateDisclosure: Boolean(data.affiliateDisclosure),
    readerFormat: data.readerFormat,
    readerIntro: data.readerIntro,
    specialtyLens: data.specialtyLens,
    products,
    pairs,
    visual: {
      styleVersion: visualRegistry.styleVersion,
      generator: visualRegistry.generator,
      rightsPosture: visualRegistry.rightsPosture,
      hero,
      scenes,
      productSceneIds: resolvedProductSceneIds,
      pairSceneIds: resolvedPairSceneIds
    },
    contentHtml: marked.parse(parsed.content)
  };
  articles.push(applyAffiliateLinkOverlays(article, affiliateLinkState));
}
const publicArticles = articles.filter((article) => article.status === 'publication_ready');
const feedArticles = [...publicArticles].sort((left, right) =>
  right.publishDate.localeCompare(left.publishDate) || left.slug.localeCompare(right.slug)
);
const publicArticleSummaries = publicArticles.map((article) => ({
  slug: article.slug,
  title: article.title,
  description: article.description,
  publishDate: article.publishDate,
  status: article.status,
  audience: article.audience,
  occasion: article.occasion,
  priceBand: article.priceBand,
  tags: article.tags,
  researchRun: article.researchRun,
  evidenceScore: article.evidenceScore,
  featured: article.featured,
  productCount: article.products.length,
  pairCount: article.pairs.length,
  paidLinkCount: article.products.filter((product) => product.affiliate).length,
  visual: { hero: article.visual.hero }
}));

const strategy = JSON.parse(await fs.readFile(strategyPath, 'utf8'));
const operations = JSON.parse(await fs.readFile(operationsPath, 'utf8'));
const growth = JSON.parse(await fs.readFile(growthPath, 'utf8'));
const banner = '// Generated by scripts/generate-content.mjs. Do not edit by hand.\n';
const publicSource = `${banner}import type { Article } from '../content.types';\n\n` +
  `export const ARTICLES: readonly Article[] = ${JSON.stringify(publicArticles, null, 2)};\n`;
const publicSummarySource = `${banner}import type { ArticleSummary } from '../content.types';\n\n` +
  `export const ARTICLE_SUMMARIES: readonly ArticleSummary[] = ${JSON.stringify(publicArticleSummaries, null, 2)};\n\n` +
  `export const CONTENT_STATS = ${JSON.stringify({
    articles: publicArticles.length,
    products: publicArticles.reduce((sum, article) => sum + article.products.length, 0),
    pairs: publicArticles.reduce((sum, article) => sum + article.pairs.length, 0),
    paidLinkCount: publicArticleSummaries.reduce((sum, article) => sum + article.paidLinkCount, 0)
  }, null, 2)} as const;\n`;
const articleLoaderSource = `${banner}import type { Article } from '../content.types';\n\n` +
  `export const ARTICLE_SLUGS = ${JSON.stringify(publicArticles.map((article) => article.slug), null, 2)} as const;\n\n` +
  `const ARTICLE_LOADERS: Record<string, () => Promise<Article>> = {\n${publicArticles.map((article) => `  ${JSON.stringify(article.slug)}: () => import('./articles/${article.slug}.generated').then(({ ARTICLE }) => ARTICLE)`).join(',\n')}\n};\n\n` +
  `export function loadArticle(slug: string | null | undefined): Promise<Article | undefined> {\n  const loader = slug ? ARTICLE_LOADERS[slug] : undefined;\n  return loader ? loader() : Promise.resolve(undefined);\n}\n`;
const studioSource = `${banner}import type { Growth, Operations, Strategy } from '../content.types';\n\n` +
  `export const OPERATIONS: Operations = ${JSON.stringify(operations, null, 2)};\n\n` +
  `export const STRATEGY: Strategy = ${JSON.stringify(strategy, null, 2)};\n\n` +
  `export const GROWTH: Growth = ${JSON.stringify(growth, null, 2)};\n`;

await fs.mkdir(generatedDir, { recursive: true });
await fs.mkdir(articleModuleDir, { recursive: true });
const expectedArticleModuleNames = new Set(publicArticles.map((article) => `${article.slug}.generated.ts`));
for (const existingName of await fs.readdir(articleModuleDir)) {
  if (existingName.endsWith('.generated.ts') && !expectedArticleModuleNames.has(existingName)) await fs.unlink(path.join(articleModuleDir, existingName));
}
await Promise.all([
  fs.writeFile(publicOutputPath, publicSource),
  fs.writeFile(publicSummaryOutputPath, publicSummarySource),
  fs.writeFile(articleLoaderOutputPath, articleLoaderSource),
  fs.writeFile(studioOutputPath, studioSource),
  ...publicArticles.map((article) => fs.writeFile(
    path.join(articleModuleDir, `${article.slug}.generated.ts`),
    `${banner}import type { Article } from '../../content.types';\n\nexport const ARTICLE: Article = ${JSON.stringify(article, null, 2)};\n`
  ))
]);
const paths = [
  '/', '/gift-finder', '/gifts', '/blog', '/standards', '/affiliate-disclosure',
  ...publicArticles.map((article) => `/blog/${article.slug}`)
];
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...paths.map((urlPath) => `  <url><loc>https://tipsforyourgifts.web.app${urlPath}</loc></url>`),
  '</urlset>',
  ''
].join('\n');
const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');
const siteUrl = 'https://tipsforyourgifts.web.app';
const latestArticleDate = feedArticles
  .flatMap((article) => [article.publishDate, article.updatedDate])
  .sort()
  .at(-1);
const rss = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '  <channel>',
  '    <title>Tips for Your Gifts</title>',
  `    <link>${siteUrl}/</link>`,
  '    <description>Thoughtful gift ideas for the people you know well—even when you do not know their hobby well.</description>',
  '    <language>en-us</language>',
  ...(latestArticleDate ? [`    <lastBuildDate>${new Date(latestArticleDate).toUTCString()}</lastBuildDate>`] : []),
  `    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />`,
  ...feedArticles.flatMap((article) => {
    const articleUrl = `${siteUrl}/blog/${article.slug}`;
    return [
      '    <item>',
      `      <title>${escapeXml(article.title)}</title>`,
      `      <link>${articleUrl}</link>`,
      `      <guid isPermaLink="true">${articleUrl}</guid>`,
      `      <pubDate>${new Date(article.publishDate).toUTCString()}</pubDate>`,
      `      <description>${escapeXml(article.description)}</description>`,
      ...article.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
      '    </item>'
    ];
  }),
  '  </channel>',
  '</rss>',
  ''
].join('\n');
await Promise.all([
  fs.writeFile(sitemapPath, sitemap),
  fs.writeFile(rssPath, rss)
]);
console.log(`Generated ${path.relative(root, publicOutputPath)}, lightweight summaries, ${publicArticles.length} route-split article module${publicArticles.length === 1 ? '' : 's'}, ${path.relative(root, rssPath)}, and deferred ${path.relative(root, studioOutputPath)}`);
