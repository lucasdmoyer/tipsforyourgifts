import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error('Usage: npm run smoke:hosted -- https://example.web.app');

const root = process.cwd();
const sitemap = await fs.readFile(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
if (paths.length === 0) throw new Error('No public routes found in sitemap.xml');

const articleDir = path.join(root, 'src', 'data', 'blog');
const articleFiles = (await fs.readdir(articleDir)).filter((name) => name.endsWith('.md'));
const articles = new Map();
for (const fileName of articleFiles) {
  const slug = path.basename(fileName, '.md');
  const article = matter(await fs.readFile(path.join(articleDir, fileName), 'utf8')).data;
  if (article.status === 'publication_ready') articles.set(slug, article);
}

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const failures = [];
await Promise.all(paths.map(async (pathname) => {
  const url = new URL(pathname, baseUrl).toString();
  let response;
  try {
    response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    failures.push(`${pathname}: request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const html = await response.text();
  if (!response.ok) failures.push(`${pathname}: HTTP ${response.status}`);
  if (!html.includes('<tfg-root')) failures.push(`${pathname}: Angular application root missing`);

  const articleMatch = pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (!articleMatch) return;
  const slug = articleMatch[1];
  const article = articles.get(slug);
  if (!article) {
    failures.push(`${pathname}: no matching publication-ready source article`);
    return;
  }
  for (const marker of ['Start with the person', 'If you know someone', 'Original illustration']) {
    if (!html.includes(marker)) failures.push(`${pathname}: missing ${JSON.stringify(marker)}`);
  }
  for (const product of article.products ?? []) {
    if (!html.includes(escapeHtml(product.name))) failures.push(`${pathname}: missing product ${product.id}`);
    if (!html.includes(escapeHtml(product.url))) failures.push(`${pathname}: missing link for ${product.id}`);
    if (!html.includes(`data-product-id="${product.id}"`)) failures.push(`${pathname}: missing outbound marker for ${product.id}`);
  }
  if ((article.pairs ?? []).length > 0) {
    for (const marker of ['Why this makes a good gift', 'Before you buy', 'not product photography']) {
      if (!html.includes(marker)) failures.push(`${pathname}: missing pairing marker ${JSON.stringify(marker)}`);
    }
  }
}));

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ hostedSmoke: 'passed', baseUrl: new URL(baseUrl).origin, routes: paths.length, articles: articles.size }, null, 2));
}
