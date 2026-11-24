import fs from 'node:fs/promises';
import path from 'node:path';
import matter from './lib/front-matter.mjs';

const root = process.cwd();
const config = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'gift-paths.json'), 'utf8'));
const blogDir = path.join(root, 'src', 'data', 'blog');
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md'));
const publicArticles = (await Promise.all(articleNames.map(async (name) => ({
  slug: path.basename(name, '.md'),
  ...matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data
})))).filter((article) => article.status === 'publication_ready');
const failures = [];
const selectedByPath = [];

if (config.schemaVersion !== '1.0.0') failures.push('gift paths: unsupported schema version');
if (!Array.isArray(config.paths) || config.paths.length !== 3) failures.push('gift paths: expected exactly three focused paths');
const ids = new Set();
const slugs = new Set();
for (const giftPath of config.paths ?? []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(giftPath.id ?? '')) failures.push(`gift paths: invalid id ${JSON.stringify(giftPath.id)}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(giftPath.slug ?? '')) failures.push(`gift paths: invalid slug ${JSON.stringify(giftPath.slug)}`);
  if (ids.has(giftPath.id)) failures.push(`gift paths: duplicate id ${giftPath.id}`);
  if (slugs.has(giftPath.slug)) failures.push(`gift paths: duplicate slug ${giftPath.slug}`);
  ids.add(giftPath.id);
  slugs.add(giftPath.slug);
  for (const key of ['eyebrow', 'title', 'description', 'lead', 'shopperCue']) {
    if (typeof giftPath[key] !== 'string' || giftPath[key].trim().length < 12) failures.push(`${giftPath.id}: missing useful ${key}`);
  }
  let selected = [];
  if (giftPath.matching?.type === 'any_tag') {
    const tags = new Set(giftPath.matching.values ?? []);
    if (tags.size < 2) failures.push(`${giftPath.id}: tag path needs at least two distinct public signals`);
    selected = publicArticles.filter((article) => (article.tags ?? []).some((tag) => tags.has(tag)));
  } else if (giftPath.matching?.type === 'minimum_pair_count') {
    if (!Number.isInteger(giftPath.matching.value) || giftPath.matching.value < 1) failures.push(`${giftPath.id}: invalid minimum pair count`);
    selected = publicArticles.filter((article) => (article.pairs ?? []).length >= giftPath.matching.value);
  } else {
    failures.push(`${giftPath.id}: unsupported matching rule`);
  }
  if (selected.length < 3) failures.push(`${giftPath.id}: path is too thin with ${selected.length} guides`);
  if (selected.some((article) => (article.products ?? []).length === 0)) failures.push(`${giftPath.id}: path includes a non-shopping editorial article`);
  selectedByPath.push(selected.map((article) => article.slug).sort().join('|'));
}
if (new Set(selectedByPath).size !== selectedByPath.length) failures.push('gift paths: two paths resolve to the same article set');

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ giftPaths: 'valid', paths: config.paths.length, publicArticles: publicArticles.length, minimumGuidesPerPath: Math.min(...selectedByPath.map((entry) => entry.split('|').length)), draftRoutesCreated: false }, null, 2));
}
