import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { parsePublicationManifest, sha256 } from './lib/publication-manifest-contract.mjs';

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error('Usage: npm run smoke:hosted -- https://example.web.app');

const root = process.cwd();
const sitemap = await fs.readFile(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const manifest = parsePublicationManifest(JSON.parse(await fs.readFile(path.join(root, 'public', 'publication-manifest.json'), 'utf8')));
const photoAssets = manifest.productVisualPosture?.assets ?? [];
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
  if (pathname === '/gifts' && !html.includes('gift-budget')) failures.push(`${pathname}: gift browse filters missing`);

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
    for (const marker of ['Why this makes a good gift', 'Before you buy', 'Product page:']) {
      if (!html.includes(marker)) failures.push(`${pathname}: missing pairing marker ${JSON.stringify(marker)}`);
    }
  }
  for (const photo of photoAssets.filter(({ articleSlug }) => articleSlug === slug)) {
    const imageIndex = html.indexOf(`src="/${photo.path}"`);
    if (imageIndex < 0 || imageIndex > html.indexOf('Start with the person')) failures.push(`${pathname}: official product image is missing from the opening of the guide`);
    try {
      const image = await fetch(new URL(`/${photo.path}`, baseUrl), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
      if (!image.ok || sha256(Buffer.from(await image.arrayBuffer())) !== photo.sha256) failures.push(`${pathname}: hosted ${photo.productId} asset differs from the exact manifest bytes`);
    } catch { failures.push(`${pathname}: could not read the exact product image`); }
  }
}));

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ hostedSmoke: 'passed', baseUrl: new URL(baseUrl).origin, routes: paths.length, articles: articles.size }, null, 2));
}
