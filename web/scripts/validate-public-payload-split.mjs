import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');
const [contentService, browserRoutes, serverRoutes, publicPages, homePage, articleCard, giftPathPage, articlePage, summaries, fullContent, loaders] = await Promise.all([
  read('src/app/content.service.ts'),
  read('src/app/app.routes.ts'),
  read('src/app/app.routes.server.ts'),
  read('src/app/public-pages.ts'),
  read('src/app/home-page.ts'),
  read('src/app/article-card.ts'),
  read('src/app/gift-path-page.ts'),
  read('src/app/article-page.ts'),
  read('src/app/generated/content-summary.generated.ts'),
  read('src/app/generated/content.generated.ts'),
  read('src/app/generated/article-loaders.generated.ts')
]);

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

expect(contentService.includes("from './generated/content-summary.generated'"), 'public content service must use lightweight summaries');
expect(!contentService.includes('content.generated'), 'public content service cannot import the full article catalog');
expect(browserRoutes.includes("import('./article-page')"), 'article routes must lazy-load the dedicated article page');
expect(browserRoutes.includes("import('./generated/article-loaders.generated')"), 'article routes must lazy-load route-specific article data');
expect(serverRoutes.includes('ARTICLE_SLUGS'), 'server prerender routes must use the slug-only manifest');
expect(!serverRoutes.includes('content.generated'), 'server route discovery cannot load the full article catalog');
expect(browserRoutes.includes("import('./home-page')"), 'homepage must lazy-load its dedicated route module');
for (const moduleName of ['gift-finder-page', 'gifts-page', 'blog-page', 'standards-page', 'affiliate-disclosure-page', 'not-found-page']) {
  expect(browserRoutes.includes(`import('./${moduleName}')`), `${moduleName} must be a direct lazy route module`);
}
expect(!browserRoutes.includes("import('./public-pages')"), 'browser routes cannot lazy-load the combined public-page barrel');
expect(!publicPages.includes('export class HomePage'), 'homepage cannot be bundled with every public utility page');
expect(homePage.includes('export class HomePage'), 'dedicated homepage module must export HomePage');
expect(homePage.includes("from './article-card'"), 'homepage must use the route-neutral article card');
expect(articleCard.includes('export class ArticleCardComponent'), 'route-neutral article card module must export ArticleCardComponent');
expect(!articleCard.includes("from './public-pages'"), 'article card cannot import the combined public-page bundle');
expect(giftPathPage.includes("from './article-card'"), 'gift paths must import the route-neutral article card directly');
expect(!giftPathPage.includes("from './public-pages'"), 'gift paths cannot load the combined public-page bundle through their card dependency');
expect(!publicPages.includes('export class ArticlePage'), 'article rendering cannot be bundled into the listing-page module');
expect(!publicPages.includes('export class ProductCardComponent'), 'article product cards cannot be bundled into the listing-page module');
expect(!publicPages.includes('export class PairCardComponent'), 'article pair cards cannot be bundled into the listing-page module');
expect(!articlePage.includes('content.generated'), 'article page cannot load the full article catalog');
expect(!articlePage.includes("from './public-pages'"), 'article page cannot import the listing-page bundle');
expect(articlePage.includes("from './article-components'"), 'article page must load article-only product and pair components');
for (const forbidden of ['"contentHtml"', '"products": [', '"pairs": [', 'https://']) {
  expect(!summaries.includes(forbidden), `lightweight article summaries contain forbidden detail: ${forbidden}`);
}

const articleModuleDirectory = path.join(root, 'src', 'app', 'generated', 'articles');
const articleModuleNames = (await fs.readdir(articleModuleDirectory)).filter((name) => name.endsWith('.generated.ts')).sort();
const loaderCount = [...loaders.matchAll(/: \(\) => import\('\.\/articles\//g)].length;
expect(articleModuleNames.length > 0, 'no route-split article modules were generated');
expect(loaderCount === articleModuleNames.length, 'article loader map and route-split module set differ');
expect(loaders.includes("import type { ArticlePageData }"), 'article loaders must use the route-only article page data contract');
for (const name of articleModuleNames) {
  const source = await fs.readFile(path.join(articleModuleDirectory, name), 'utf8');
  expect(source.includes('export const ARTICLE: ArticlePageData ='), `${name} does not export one typed article page payload`);
}

const summaryBytes = Buffer.byteLength(summaries);
const fullCatalogBytes = Buffer.byteLength(fullContent);
expect(summaryBytes < fullCatalogBytes * 0.2, 'listing summary payload exceeds 20% of the full article catalog');

console.log(JSON.stringify({
  publicPayloadSplit: 'valid',
  articleModules: articleModuleNames.length,
  summaryBytes,
  fullCatalogBytes,
  summarySharePercent: Number(((summaryBytes / fullCatalogBytes) * 100).toFixed(2)),
  fullCatalogImportedByBrowserListings: false,
  homePageIsolated: true,
  utilityPagesIsolated: true,
  articleCardSharedWithoutPublicPageBundle: true
}, null, 2));
