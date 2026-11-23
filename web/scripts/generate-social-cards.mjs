import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const articleCardDir = path.join(publicDir, 'social-cards');
const manifest = JSON.parse(await fs.readFile(path.join(publicDir, 'publication-manifest.json'), 'utf8'));
const registry = JSON.parse(await fs.readFile(path.join(root, 'visuals', 'article-visuals.json'), 'utf8'));
const assetsById = new Map(registry.assets.map((asset) => [asset.id, asset]));
const articlesBySlug = new Map(registry.articles.map((article) => [article.slug, article]));

await fs.rm(articleCardDir, { recursive: true, force: true });
await fs.mkdir(articleCardDir, { recursive: true });

const genericSource = path.join(publicDir, 'social-card.svg');
const genericDestination = path.join(publicDir, 'social-card.jpg');
await sharp(genericSource)
  .resize(1200, 630, { fit: 'fill' })
  .flatten({ background: '#f8f3e8' })
  .jpeg({ quality: 88, progressive: true, chromaSubsampling: '4:4:4' })
  .toFile(genericDestination);

const generated = [];
for (const article of manifest.articles) {
  const mapping = articlesBySlug.get(article.articleSlug);
  if (!mapping) throw new Error(`${article.articleSlug}: publication manifest article has no visual mapping`);
  const asset = assetsById.get(mapping.heroId);
  if (!asset) throw new Error(`${article.articleSlug}: visual mapping has no registered hero asset`);
  const source = path.join(publicDir, asset.src.replace(/^\//, ''));
  const destination = path.join(articleCardDir, `${article.articleSlug}.jpg`);
  await sharp(source)
    .resize(1200, 630, { fit: 'contain', background: '#f8f3e8' })
    .flatten({ background: '#f8f3e8' })
    .jpeg({ quality: 86, progressive: true, chromaSubsampling: '4:4:4' })
    .toFile(destination);
  generated.push({ slug: article.articleSlug, source: path.relative(root, source), output: path.relative(root, destination) });
}

console.log(JSON.stringify({
  socialCards: 'generated',
  defaultCard: path.relative(root, genericDestination),
  articleCards: generated.length,
  dimensions: '1200x630',
  format: 'jpeg',
  generated
}, null, 2));
