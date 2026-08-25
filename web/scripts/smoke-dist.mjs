import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { buildPublicationManifest, parsePublicationManifest, sha256 } from './lib/publication-manifest-contract.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const checks = [
  ['home', 'index.html', ['Good gifts, minus the guesswork.', 'THE REAL GIFT', 'Give them permission to enjoy it.', 'rel="canonical"', 'tfg-root']],
  ['gift finder', 'gift-finder/index.html', ['Who are they when no one is shopping for them?', 'Places to begin', 'Do not invent a new person for them.', 'gift_finder_guide_open']],
  ['blog index', 'blog/index.html', ['A gift starts before the shopping.', 'The Gift Hiding in Plain Sight']],
  ['standards', 'standards/index.html', ['Buy the thing they would talk themselves out of.', 'A thoughtful gift says: I noticed the part of your life you keep putting second.']],
  ['studio', 'studio/index.html', ['Executive studio', 'Founder agenda', 'unknown until aggregate measurement', 'noindex,nofollow']],
  ['founder brief builder', 'studio/brief/index.html', ['Founder brief builder', 'Notice the gift before naming the product.', 'Complete the missing decisions', 'noindex,nofollow']],
  ['robots', 'robots.txt', ['Disallow: /studio', 'Sitemap:']],
  ['sitemap', 'sitemap.xml', ['blog/how-we-research-gifts', 'standards']],
  ['publication manifest', 'publication-manifest.json', ['"status": "release_candidate"', '"projectId": "tipsforyourgifts"']]
];
const forbiddenLegacyMarkers = [
  'https://amzn.to/2UiRnkY',
  'The Summer Reading Pick for President Barack Obama, Bill Gates, and Mark Zuckerberg',
  'Email TipsForYourGifts.com at lucasdmoyer@gmail.com'
];

const failures = [];
const escapeHtmlText = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
let publicationManifest;
let publicationManifestSha256;
for (const [label, relativePath, markers] of checks) {
  const filePath = path.join(dist, relativePath);
  let contents;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch {
    failures.push(`${label}: missing ${relativePath}`);
    continue;
  }
  for (const marker of markers) {
    if (!contents.includes(marker)) failures.push(`${label}: missing marker ${JSON.stringify(marker)}`);
  }
  if (relativePath.endsWith('.html') && contents.includes('ng-event-dispatch-contract')) {
    failures.push(`${label}: contains an inline event-replay script blocked by the Firebase CSP`);
  }
  if (relativePath.endsWith('.html') && /<link[^>]+rel="stylesheet"[^>]+onload=/.test(contents)) {
    failures.push(`${label}: stylesheet depends on an inline onload handler blocked by the Firebase CSP`);
  }
}

try {
  const sourceManifestRaw = await fs.readFile(path.join(root, 'public', 'publication-manifest.json'));
  const distManifestRaw = await fs.readFile(path.join(dist, 'publication-manifest.json'));
  if (!sourceManifestRaw.equals(distManifestRaw)) failures.push('publication manifest: built bytes differ from the validated public source');
  publicationManifest = parsePublicationManifest(JSON.parse(distManifestRaw.toString('utf8')));
  publicationManifestSha256 = sha256(distManifestRaw);
  const expectedManifest = await buildPublicationManifest(root);
  if (JSON.stringify(publicationManifest) !== JSON.stringify(expectedManifest)) failures.push('publication manifest: release-candidate ledger is stale or differs from source evidence');
} catch (error) {
  failures.push(`publication manifest: ${error instanceof Error ? error.message : String(error)}`);
}

const blogDir = path.join(root, 'src', 'data', 'blog');
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md'));
const sourceArticles = await Promise.all(articleNames.map(async (name) => ({
  slug: path.basename(name, '.md'),
  ...matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data
})));
const readyArticles = sourceArticles.filter((article) => article.status === 'publication_ready');
const draftArticles = sourceArticles.filter((article) => article.status === 'draft');
const operations = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'operations.json'), 'utf8'));
const studioHtml = await fs.readFile(path.join(dist, 'studio', 'index.html'), 'utf8');
const agendaCountLabel = `${operations.founderAgenda.decisions.length} decision${operations.founderAgenda.decisions.length === 1 ? '' : 's'}. One clear order.`;
if (!studioHtml.includes(agendaCountLabel)) failures.push(`studio: founder agenda count differs from operations data: ${JSON.stringify(agendaCountLabel)}`);
for (const decision of operations.founderAgenda.decisions) {
  if (!studioHtml.includes(decision.title)) failures.push(`studio: missing founder decision ${decision.id}`);
}
if (operations.publication.currentLive.status === 'verified_managed_content_release') {
  for (const marker of [operations.publication.currentLive.manifestId, operations.publication.currentLive.receiptId, operations.publication.currentLive.contentSetSha256]) {
    if (!studioHtml.includes(marker)) failures.push(`studio: missing durable live-release marker ${JSON.stringify(marker)}`);
  }
} else if (!studioHtml.includes('no verified managed release is recorded')) {
  failures.push('studio: missing truthful no-managed-release posture');
}
if (publicationManifest) {
  const readySlugs = [...readyArticles.map((article) => article.slug)].sort();
  const manifestSlugs = [...publicationManifest.articles.map((article) => article.articleSlug)].sort();
  if (JSON.stringify(readySlugs) !== JSON.stringify(manifestSlugs)) failures.push('publication manifest: article set differs from publication-ready source articles');
  if (publicationManifest.counts.independentReviews !== readyArticles.length) failures.push('publication manifest: every release-candidate article must have an independent review');
  for (const marker of [publicationManifest.manifestId, `${publicationManifest.counts.articles} articles`, `${publicationManifest.counts.independentReviews} independent receipts`]) {
    if (!studioHtml.includes(marker)) failures.push(`studio: release-candidate accountability missing ${JSON.stringify(marker)}`);
  }
}
const blogIndex = await fs.readFile(path.join(dist, 'blog', 'index.html'), 'utf8');
const giftsIndex = await fs.readFile(path.join(dist, 'gifts', 'index.html'), 'utf8');
const sitemap = await fs.readFile(path.join(dist, 'sitemap.xml'), 'utf8');
for (const article of readyArticles) {
  const relativePath = path.join('blog', article.slug, 'index.html');
  let html;
  try { html = await fs.readFile(path.join(dist, relativePath), 'utf8'); }
  catch { failures.push(`${article.slug}: missing prerendered article`); continue; }
  const readerTitle = article.slug === 'how-we-research-gifts' ? 'The Gift Hiding in Plain Sight' : article.title;
  for (const marker of [readerTitle, 'The thought behind the gift', 'application/ld+json']) {
    if (!html.includes(marker)) failures.push(`${article.slug}: article HTML missing ${JSON.stringify(marker)}`);
  }
  if (!blogIndex.includes(readerTitle)) failures.push(`${article.slug}: missing from blog index`);
  if (!sitemap.includes(`/blog/${article.slug}`)) failures.push(`${article.slug}: missing from sitemap`);
  const products = Array.isArray(article.products) ? article.products : [];
  if (products.length > 0 && !giftsIndex.includes(article.title)) failures.push(`${article.slug}: roundup missing from gifts index`);
  for (const product of products) {
    if (!html.includes(escapeHtmlText(product.name))) failures.push(`${article.slug}: missing product ${product.id}`);
    if (!html.includes(product.drawback)) failures.push(`${article.slug}: missing drawback for ${product.id}`);
  }
}

const readerFacingHtml = [
  await fs.readFile(path.join(dist, 'index.html'), 'utf8'),
  await fs.readFile(path.join(dist, 'gift-finder', 'index.html'), 'utf8'),
  await fs.readFile(path.join(dist, 'gifts', 'index.html'), 'utf8'),
  await fs.readFile(path.join(dist, 'blog', 'index.html'), 'utf8'),
  await fs.readFile(path.join(dist, 'standards', 'index.html'), 'utf8'),
  ...await Promise.all(readyArticles.map((article) => fs.readFile(path.join(dist, 'blog', article.slug, 'index.html'), 'utf8')))
].join('\n');
for (const marker of [
  'Advice that earns the click.',
  'minimum editorial score',
  'The drafting agent cannot certify',
  'Research run:',
  'Pair coherence ',
  'desk research',
  'publication-ready',
  'editorial review',
  'qualified pair',
  'independently qualified',
  'conditionally qualified',
  'What the research rejected',
  'was demoted',
  'independent editorial QA',
  'This draft must'
]) {
  if (readerFacingHtml.includes(marker)) failures.push(`reader voice: public pages expose internal process copy ${JSON.stringify(marker)}`);
}
if (/(?:Editorial|Evidence) \d+\/100/.test(readerFacingHtml)) failures.push('reader voice: public pages expose internal numeric scoring');
if (/(?:pair|pairing) (?:clears|scores)|\d+\/100 (?:coherence|for coherence)/i.test(readerFacingHtml)) failures.push('reader voice: public pages expose internal pairing scores');
const jsNames = (await fs.readdir(dist)).filter((name) => name.endsWith('.js'));
const publicJs = (await Promise.all(jsNames.map((name) => fs.readFile(path.join(dist, name), 'utf8')))).join('\n');
for (const article of draftArticles) {
  if (publicJs.includes(article.title)) failures.push(`${article.slug}: draft content leaked into the public JavaScript bundle`);
}

const deployTextPaths = (await fs.readdir(dist, { recursive: true }))
  .filter((name) => /\.(?:css|html|js|json|svg|txt|xml)$/.test(name));
const deployText = (await Promise.all(deployTextPaths.map((name) => fs.readFile(path.join(dist, name), 'utf8')))).join('\n');
for (const marker of forbiddenLegacyMarkers) {
  if (deployText.includes(marker)) failures.push(`legacy migration: release candidate contains forbidden historical marker ${JSON.stringify(marker)}`);
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ smoke: 'passed', staticChecks: checks.length, legacySurfaceMarkersChecked: forbiddenLegacyMarkers.length, publicationReadyArticles: readyArticles.length, publicationManifestId: publicationManifest?.manifestId, publicationManifestSha256, noProductionWritesAttempted: true }, null, 2));
}
