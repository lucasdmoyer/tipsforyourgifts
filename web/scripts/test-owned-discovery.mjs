import fs from 'node:fs/promises';
import path from 'node:path';
import matter from './lib/front-matter.mjs';

const root = process.cwd();
const blogDir = path.join(root, 'src', 'data', 'blog');
const rss = await fs.readFile(path.join(root, 'public', 'rss.xml'), 'utf8');
const sitemap = await fs.readFile(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const visualRegistry = JSON.parse(await fs.readFile(path.join(root, 'visuals', 'article-visuals.json'), 'utf8'));
const index = await fs.readFile(path.join(root, 'src', 'index.html'), 'utf8');
const shell = await fs.readFile(path.join(root, 'src', 'app', 'app.html'), 'utf8');
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md'));
const articles = await Promise.all(articleNames.map(async (name) => ({
  slug: path.basename(name, '.md'),
  ...matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data
})));

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');
const ready = articles.filter((article) => article.status === 'publication_ready');
const drafts = articles.filter((article) => article.status !== 'publication_ready');
const visualAssets = new Map(visualRegistry.assets.map((asset) => [asset.id, asset]));
const articleVisuals = new Map(visualRegistry.articles.map((article) => [article.slug, article]));
const failures = [];

for (const marker of [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '<atom:link href="https://tipsforyourgifts.web.app/rss.xml" rel="self" type="application/rss+xml" />'
]) {
  if (!rss.includes(marker)) failures.push(`RSS feed missing ${JSON.stringify(marker)}`);
}
if ([...rss.matchAll(/<item>/g)].length !== ready.length) failures.push(`RSS feed item count must equal ${ready.length} publication-ready articles`);
for (const marker of [
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  '<image:image>',
  '<image:loc>'
]) {
  if (!sitemap.includes(marker)) failures.push(`Sitemap missing ${JSON.stringify(marker)}`);
}
if ([...sitemap.matchAll(/<image:image>/g)].length !== ready.length) failures.push(`Sitemap image count must equal ${ready.length} publication-ready articles`);
for (const article of ready) {
  for (const marker of [escapeXml(article.title), escapeXml(article.description), `/blog/${article.slug}`]) {
    if (!rss.includes(marker)) failures.push(`${article.slug}: RSS feed missing ${JSON.stringify(marker)}`);
  }
  const visualEntry = articleVisuals.get(article.slug);
  const hero = visualEntry ? visualAssets.get(visualEntry.heroId) : undefined;
  if (!hero) {
    failures.push(`${article.slug}: sitemap validation cannot resolve its approved hero visual`);
    continue;
  }
  const heroUrl = `https://tipsforyourgifts.web.app${hero.src.replace(/\.webp$/, '-1200.webp')}`;
  for (const marker of [
    `<loc>https://tipsforyourgifts.web.app/blog/${article.slug}</loc>`,
    `<lastmod>${new Date(article.updatedDate ?? article.publishDate).toISOString()}</lastmod>`,
    `<image:loc>${escapeXml(heroUrl)}</image:loc>`
  ]) {
    if (!sitemap.includes(marker)) failures.push(`${article.slug}: sitemap missing ${JSON.stringify(marker)}`);
  }
}
for (const article of drafts) {
  if (rss.includes(escapeXml(article.title)) || rss.includes(`/blog/${article.slug}`)) failures.push(`${article.slug}: non-public article leaked into RSS`);
  if (sitemap.includes(`/blog/${article.slug}`)) failures.push(`${article.slug}: non-public article leaked into sitemap`);
}
for (const marker of ['/studio', 'researchRun', 'evidenceScore', '<script', 'affiliate=true', 'data-paid-link']) {
  if (rss.includes(marker)) failures.push(`RSS feed contains forbidden internal or commercial marker ${JSON.stringify(marker)}`);
  if (sitemap.includes(marker)) failures.push(`Sitemap contains forbidden internal or commercial marker ${JSON.stringify(marker)}`);
}
for (const deprecatedTag of ['<image:caption>', '<image:title>', '<image:license>', '<image:geo_location>']) {
  if (sitemap.includes(deprecatedTag)) failures.push(`Sitemap contains deprecated Google image tag ${JSON.stringify(deprecatedTag)}`);
}
if (!index.includes('rel="alternate" type="application/rss+xml"')) failures.push('Document head does not advertise the RSS feed');
if (!shell.includes('href="/rss.xml">RSS feed</a>')) failures.push('Reader footer does not link to the RSS feed');

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ownedDiscovery: 'passed', feed: 'public/rss.xml', sitemap: 'public/sitemap.xml', items: ready.length, indexedImages: ready.length, draftsExcluded: drafts.length, affiliateTrackingIncluded: false }, null, 2));
}
