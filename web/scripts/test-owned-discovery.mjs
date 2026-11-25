import fs from 'node:fs/promises';
import path from 'node:path';
import matter from './lib/front-matter.mjs';

const root = process.cwd();
const blogDir = path.join(root, 'src', 'data', 'blog');
const rss = await fs.readFile(path.join(root, 'public', 'rss.xml'), 'utf8');
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
const failures = [];

for (const marker of [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '<atom:link href="https://tipsforyourgifts.web.app/rss.xml" rel="self" type="application/rss+xml" />'
]) {
  if (!rss.includes(marker)) failures.push(`RSS feed missing ${JSON.stringify(marker)}`);
}
if ([...rss.matchAll(/<item>/g)].length !== ready.length) failures.push(`RSS feed item count must equal ${ready.length} publication-ready articles`);
for (const article of ready) {
  for (const marker of [escapeXml(article.title), escapeXml(article.description), `/blog/${article.slug}`]) {
    if (!rss.includes(marker)) failures.push(`${article.slug}: RSS feed missing ${JSON.stringify(marker)}`);
  }
}
for (const article of drafts) {
  if (rss.includes(escapeXml(article.title)) || rss.includes(`/blog/${article.slug}`)) failures.push(`${article.slug}: non-public article leaked into RSS`);
}
for (const marker of ['/studio', 'researchRun', 'evidenceScore', '<script', 'affiliate=true', 'data-paid-link']) {
  if (rss.includes(marker)) failures.push(`RSS feed contains forbidden internal or commercial marker ${JSON.stringify(marker)}`);
}
if (!index.includes('rel="alternate" type="application/rss+xml"')) failures.push('Document head does not advertise the RSS feed');
if (!shell.includes('href="/rss.xml">RSS feed</a>')) failures.push('Reader footer does not link to the RSS feed');

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ownedDiscovery: 'passed', feed: 'public/rss.xml', items: ready.length, draftsExcluded: drafts.length, affiliateTrackingIncluded: false }, null, 2));
}
