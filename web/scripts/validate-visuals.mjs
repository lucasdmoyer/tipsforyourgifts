import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';

const root = process.cwd();
const visualRegistryPath = path.join(root, 'visuals', 'article-visuals.json');
const independentReviewPath = path.join(root, 'visuals', 'reviews', 'gift-thread-v1.qa.json');
const blogDir = path.join(root, 'src', 'data', 'blog');
const visualRegistrySource = await fs.readFile(visualRegistryPath);
const registry = JSON.parse(visualRegistrySource.toString('utf8'));
const promptBook = await fs.readFile(path.join(root, registry.promptBookPath ?? ''), 'utf8');
const independentReview = JSON.parse(await fs.readFile(independentReviewPath, 'utf8'));
const errors = [];

const expect = (condition, message) => { if (!condition) errors.push(message); };
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const readUInt24LE = (buffer, offset) => buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
const fileExists = async (filePath) => fs.access(filePath).then(() => true).catch(() => false);

expect(independentReview.schemaVersion === '1.0.0', 'Independent visual review schemaVersion must be 1.0.0');
expect(independentReview.receiptId === 'gift-thread-v1-independent-visual-qa', 'Independent visual review receiptId is invalid');
expect(independentReview.reviewerRole === 'independent-visual-editor', 'Independent visual review must come from an independent visual editor');
expect(typeof independentReview.reviewerId === 'string' && independentReview.reviewerId.length >= 12, 'Independent visual review needs a reviewerId');
expect(independentReview.verdict === 'passed', 'Independent visual review verdict must be passed');
expect(Array.isArray(independentReview.blockers) && independentReview.blockers.length === 0, 'Independent visual review must have no blockers');
expect(typeof independentReview.reviewedAt === 'string' && !Number.isNaN(Date.parse(independentReview.reviewedAt)), 'Independent visual review needs a valid reviewedAt timestamp');
expect(independentReview.registryPath === 'visuals/article-visuals.json', 'Independent visual review must bind the visual registry');
expect(independentReview.registrySha256 === sha256(visualRegistrySource), 'Independent visual review registrySha256 is stale');
expect(independentReview.promptBookPath === registry.promptBookPath, 'Independent visual review must bind the prompt book');
expect(independentReview.promptBookSha256 === sha256(Buffer.from(promptBook)), 'Independent visual review promptBookSha256 is stale');
for (const requiredCheck of ['sourceAndPromptProvenance', 'fileIntegrity', 'productContextTruth', 'copyrightAndTradeDressBoundary', 'accessibilitySemantics', 'responsiveLayout', 'draftIsolation']) {
  expect(independentReview.checks?.[requiredCheck] === true, `Independent visual review must pass ${requiredCheck}`);
}

function webpDimensions(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && size >= 10) {
      return { width: readUInt24LE(buffer, data + 4) + 1, height: readUInt24LE(buffer, data + 7) + 1 };
    }
    if (type === 'VP8 ' && size >= 10 && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff };
    }
    if (type === 'VP8L' && size >= 5 && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    offset = data + size + (size % 2);
  }
  return null;
}

expect(registry.schemaVersion === '1.0.0', 'Visual registry schemaVersion must be 1.0.0');
expect(registry.styleVersion === 'gift-thread-editorial-cartoon-v1.0', 'Visual registry must use the approved Gift-Thread v1.0 style');
expect(registry.status === 'founder_approved', 'Visual registry must be founder approved');
expect(registry.generator === 'openai-built-in-imagegen', 'Visual registry must identify the built-in image generator');
expect(registry.rightsPosture === 'founder-approved-original-ai-generated', 'Visual registry rights posture is not approved');
expect(registry.dimensions?.width === 1536 && registry.dimensions?.height === 1024, 'Visual registry must declare 1536x1024 assets');
expect(typeof registry.approvalEvidence === 'string' && registry.approvalEvidence.length >= 40, 'Visual registry needs founder approval evidence');
expect(registry.promptBookPath === 'visuals/PROMPTS.md', 'Visual registry must bind the approved prompt book');
expect(registry.sourcePathPattern === 'visuals/sources/{assetId}.png', 'Visual registry must bind retained source paths');
expect(registry.draftFilePathPattern === 'visuals/drafts/{assetId}.webp', 'Visual registry must bind draft-only delivery paths');
const responsiveQaPendingOverride = process.env.TFG_VISUAL_RESPONSIVE_QA_PENDING === '1';
expect(registry.responsivePreviewPassed === true || responsiveQaPendingOverride, 'Visual registry responsivePreviewPassed must be true before release');
if (registry.responsivePreviewPassed === true) {
  expect(typeof registry.responsiveEvidence?.testedAt === 'string' && !Number.isNaN(Date.parse(registry.responsiveEvidence.testedAt)), 'Responsive evidence needs a valid testedAt timestamp');
  expect(registry.responsiveEvidence?.result === 'passed', 'Responsive evidence result must be passed');
  expect(registry.responsiveEvidence?.brokenPublicAssets === 0, 'Responsive evidence must report zero broken public assets');
  expect(registry.responsiveEvidence?.horizontalOverflow === false, 'Responsive evidence must report no horizontal overflow');
  expect(registry.responsiveEvidence?.draftRoutesAndAssetsPubliclyReachable === false, 'Responsive evidence must prove draft routes and assets are not public');
  expect((registry.responsiveEvidence?.viewports ?? []).includes('1440x1000'), 'Responsive evidence must cover the 1440x1000 desktop viewport');
  expect((registry.responsiveEvidence?.viewports ?? []).includes('390x844'), 'Responsive evidence must cover the 390x844 mobile viewport');
  for (const requiredRoute of ['/blog', '/blog/read-it-then-play-it-gift-pairs', '/blog/one-photo-one-story-gift-pairs', '/blog/gifts-for-a-golf-friend']) {
    expect((registry.responsiveEvidence?.routes ?? []).includes(requiredRoute), `Responsive evidence must cover ${requiredRoute}`);
  }
}

const promptSections = new Map(promptBook.split(/^## /m).slice(1).map((section) => {
  const newline = section.indexOf('\n');
  return [section.slice(0, newline).trim(), section.slice(newline + 1).trim()];
}));
const articleFiles = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md')).sort();
const articles = new Map();
for (const fileName of articleFiles) {
  const slug = path.basename(fileName, '.md');
  const parsed = matter(await fs.readFile(path.join(blogDir, fileName), 'utf8'));
  articles.set(slug, { status: parsed.data.status, products: parsed.data.products ?? [], pairs: parsed.data.pairs ?? [] });
}

const assets = new Map();
for (const asset of registry.assets ?? []) {
  expect(typeof asset.id === 'string' && /^[a-z0-9-]+$/.test(asset.id), `Invalid visual asset id: ${asset.id}`);
  expect(!assets.has(asset.id), `Duplicate visual asset id: ${asset.id}`);
  assets.set(asset.id, asset);
  expect(typeof asset.alt === 'string' && asset.alt.length >= 40 && asset.alt.length <= 240, `${asset.id}: alt text must be 40-240 characters`);
  expect(!/^image (of|showing)/i.test(asset.alt ?? ''), `${asset.id}: alt text must describe purpose, not start with "image of/showing"`);
  expect(typeof asset.caption === 'string' && asset.caption.length >= 30 && asset.caption.length <= 280, `${asset.id}: caption must be 30-280 characters`);
  expect(typeof asset.promptSummary === 'string' && asset.promptSummary.length >= 40, `${asset.id}: prompt summary is missing`);
  expect((promptSections.get(asset.id)?.length ?? 0) >= 500, `${asset.id}: complete generation prompt is missing from ${registry.promptBookPath}`);
  expect(/^[a-f0-9]{64}$/.test(asset.sourceSha256 ?? ''), `${asset.id}: sourceSha256 is invalid`);
  expect(/^[a-f0-9]{64}$/.test(asset.fileSha256 ?? ''), `${asset.id}: fileSha256 is invalid`);
  expect(typeof asset.src === 'string' && asset.src.startsWith('/blog-images/') && asset.src.endsWith('.webp'), `${asset.id}: src must be a local WebP under /blog-images/`);
  const sourcePath = path.join(root, registry.sourcePathPattern.replace('{assetId}', asset.id));
  try {
    const source = await fs.readFile(sourcePath);
    expect(sha256(source) === asset.sourceSha256, `${asset.id}: sourceSha256 does not match retained source ${path.relative(root, sourcePath)}`);
  } catch (error) {
    errors.push(`${asset.id}: cannot read retained source ${path.relative(root, sourcePath)} (${error.message})`);
  }
}

const visualArticles = new Map();
const publicAssetIds = new Set();
const draftAssetIds = new Set();
for (const entry of registry.articles ?? []) {
  expect(typeof entry.slug === 'string' && articles.has(entry.slug), `Visual mapping references unknown article: ${entry.slug}`);
  expect(!visualArticles.has(entry.slug), `Duplicate visual article mapping: ${entry.slug}`);
  visualArticles.set(entry.slug, entry);
  expect(assets.has(entry.heroId), `${entry.slug}: unknown hero asset ${entry.heroId}`);
  const article = articles.get(entry.slug);
  if (!article) continue;
  const targetSet = article.status === 'publication_ready' ? publicAssetIds : draftAssetIds;
  targetSet.add(entry.heroId);
  for (const assetId of Object.values(entry.pairSceneIds ?? {})) targetSet.add(assetId);
  const pairIds = new Set(article.pairs.map((pair) => pair.id));
  for (const [pairId, assetId] of Object.entries(entry.pairSceneIds ?? {})) {
    expect(pairIds.has(pairId), `${entry.slug}: pairSceneIds references unknown pair ${pairId}`);
    expect(assets.has(assetId), `${entry.slug}: pair ${pairId} references unknown asset ${assetId}`);
  }
  if (entry.pairSceneIds) {
    expect(pairIds.size === Object.keys(entry.pairSceneIds).length, `${entry.slug}: explicit pairSceneIds must cover every pair`);
  }
  for (const product of article.products) {
    const pair = article.pairs.find((candidate) => candidate.anchorProductId === product.id || candidate.companionProductId === product.id);
    const resolvedAssetId = (pair && entry.pairSceneIds?.[pair.id]) || entry.heroId;
    expect(assets.has(resolvedAssetId), `${entry.slug}: product ${product.id} does not resolve to a visual`);
  }
  for (const pair of article.pairs) {
    const resolvedAssetId = entry.pairSceneIds?.[pair.id] ?? entry.heroId;
    expect(assets.has(resolvedAssetId), `${entry.slug}: pair ${pair.id} does not resolve to a visual`);
  }
}

for (const slug of articles.keys()) expect(visualArticles.has(slug), `Article has no visual mapping: ${slug}`);
for (const slug of visualArticles.keys()) expect(articles.has(slug), `Visual mapping has no article: ${slug}`);
for (const assetId of draftAssetIds) expect(!publicAssetIds.has(assetId), `${assetId}: one visual cannot be both draft-only and public`);

for (const asset of assets.values()) {
  if (typeof asset.src !== 'string') continue;
  const publicPath = path.join(root, 'public', asset.src.replace(/^\//, ''));
  const draftPath = path.join(root, registry.draftFilePathPattern.replace('{assetId}', asset.id));
  const isPublic = publicAssetIds.has(asset.id);
  const isDraft = draftAssetIds.has(asset.id);
  expect(isPublic || isDraft, `${asset.id}: visual is not bound to any article`);
  const filePath = isPublic ? publicPath : draftPath;
  try {
    const buffer = await fs.readFile(filePath);
    expect(buffer.length <= 600 * 1024, `${asset.id}: optimized WebP exceeds 600 KiB`);
    expect(sha256(buffer) === asset.fileSha256, `${asset.id}: fileSha256 does not match ${path.relative(root, filePath)}`);
    const dimensions = webpDimensions(buffer);
    expect(dimensions?.width === 1536 && dimensions?.height === 1024, `${asset.id}: WebP must be exactly 1536x1024, got ${dimensions ? `${dimensions.width}x${dimensions.height}` : 'unreadable dimensions'}`);
  } catch (error) {
    errors.push(`${asset.id}: cannot read ${path.relative(root, filePath)} (${error.message})`);
  }
  if (isDraft) expect(!(await fileExists(publicPath)), `${asset.id}: draft-only asset must not exist under public/`);
  if (isPublic) expect(!(await fileExists(draftPath)), `${asset.id}: public asset must not have a stale draft delivery copy`);
}

const publicImageRoot = path.join(root, 'public', 'blog-images');
const publicWebps = [];
for (const directory of await fs.readdir(publicImageRoot, { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  for (const name of await fs.readdir(path.join(publicImageRoot, directory.name))) {
    if (name.endsWith('.webp')) publicWebps.push(`/blog-images/${directory.name}/${name}`);
  }
}
const registeredPublicSources = new Set([...publicAssetIds].map((id) => assets.get(id)?.src));
for (const src of publicWebps) expect(registeredPublicSources.has(src), `Unregistered deployable visual: ${src}`);
expect(publicWebps.length === publicAssetIds.size, `Deployable WebP count ${publicWebps.length} must match ${publicAssetIds.size} public registry assets`);

const productCount = [...articles.values()].reduce((sum, article) => sum + article.products.length, 0);
const pairCount = [...articles.values()].reduce((sum, article) => sum + article.pairs.length, 0);
expect(independentReview.scope?.sourceAssetsReviewed === assets.size, 'Independent visual review source asset count is stale');
expect(independentReview.scope?.publicAssetsReviewed === publicAssetIds.size, 'Independent visual review public asset count is stale');
expect(independentReview.scope?.draftOnlyAssetsReviewed === draftAssetIds.size, 'Independent visual review draft-only asset count is stale');
expect(independentReview.scope?.articleMappingsReviewed === articles.size, 'Independent visual review article mapping count is stale');
expect(independentReview.scope?.productMappingsReviewed === productCount, 'Independent visual review product mapping count is stale');
expect(independentReview.scope?.pairMappingsReviewed === pairCount, 'Independent visual review pair mapping count is stale');

if (errors.length > 0) {
  console.error(`Visual validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${assets.size} original visuals (${publicAssetIds.size} public, ${draftAssetIds.size} draft-only) across ${articles.size} articles, ${productCount} products, and ${pairCount} pairs`);
