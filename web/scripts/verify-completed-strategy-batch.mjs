import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [basePath, currentPath] = process.argv.slice(2);
if (!basePath || !currentPath) {
  throw new Error('Usage: node web/scripts/verify-completed-strategy-batch.mjs <base-strategy.json> <current-strategy.json>');
}

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const [base, current] = await Promise.all([
  fs.readFile(path.resolve(basePath), 'utf8').then(JSON.parse),
  fs.readFile(path.resolve(currentPath), 'utf8').then(JSON.parse)
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function withoutApprovalState(idea) {
  const copy = structuredClone(idea);
  delete copy.revision;
  delete copy.founderDisposition;
  return copy;
}

const baseEnvelope = structuredClone(base);
const currentEnvelope = structuredClone(current);
for (const envelope of [baseEnvelope, currentEnvelope]) {
  delete envelope.updatedAt;
  delete envelope.currentBet;
  delete envelope.ideas;
}
if (canonicalJson(baseEnvelope) !== canonicalJson(currentEnvelope)) {
  throw new Error('Completed strategy batch changed a protected top-level strategy field');
}
if (!(Date.parse(current.updatedAt) > Date.parse(base.updatedAt))) {
  throw new Error('Completed strategy batch must advance updatedAt');
}
if (typeof current.currentBet !== 'string' || current.currentBet.trim().length < 20) {
  throw new Error('Completed strategy batch must retain a concrete current bet');
}

const baseById = new Map(base.ideas.map((idea) => [idea.id, idea]));
const currentById = new Map(current.ideas.map((idea) => [idea.id, idea]));
if (currentById.size !== current.ideas.length || baseById.size !== base.ideas.length) {
  throw new Error('Strategy ideas must have unique IDs');
}
for (const ideaId of baseById.keys()) {
  if (!currentById.has(ideaId)) throw new Error(`Completed strategy batch removed ${ideaId}`);
}

const baseMaxId = Math.max(...base.ideas.map((idea) => Number(/^founder-idea-(\d{3})$/.exec(idea.id)?.[1] ?? 0)));
const approvedIdeas = [];
for (const idea of current.ideas) {
  const before = baseById.get(idea.id);
  if (!before) {
    const expectedId = `founder-idea-${String(baseMaxId + 1).padStart(3, '0')}`;
    if (idea.id !== expectedId || idea.revision !== 2 || idea.founderDisposition !== 'approved_for_research') {
      throw new Error('A completed strategy batch may add only the next sequential idea at approved revision 2');
    }
    approvedIdeas.push(idea);
    continue;
  }
  if (canonicalJson(before) === canonicalJson(idea)) continue;
  if (before.founderDisposition !== 'proposed' || idea.founderDisposition !== 'approved_for_research' || idea.revision !== before.revision + 1) {
    throw new Error(`${idea.id} is not an exact proposed-to-approved transition`);
  }
  if (canonicalJson(withoutApprovalState(before)) !== canonicalJson(withoutApprovalState(idea))) {
    throw new Error(`${idea.id} changed editorial strategy while being approved`);
  }
  approvedIdeas.push(idea);
}
if (approvedIdeas.length < 2 || approvedIdeas.length > 3) {
  throw new Error('Completed strategy batch requires two or three exact approved ideas');
}

const runDirectory = path.join(webRoot, 'research', 'runs');
const runFiles = (await fs.readdir(runDirectory)).filter((name) => name.endsWith('.json'));
const runs = await Promise.all(runFiles.map(async (name) => ({
  path: path.join(runDirectory, name),
  value: JSON.parse(await fs.readFile(path.join(runDirectory, name), 'utf8'))
})));

const completedRuns = [];
for (const idea of approvedIdeas) {
  const ideaSha256 = crypto.createHash('sha256').update(`${canonicalJson(idea)}\n`).digest('hex');
  const matches = runs.filter(({ value }) => value.ideaId === idea.id && value.ideaRevision === idea.revision && value.ideaSha256 === ideaSha256);
  if (matches.length !== 1) throw new Error(`${idea.id} must have exactly one digest-bound research run`);
  const run = matches[0].value;
  if (run.status !== 'validated' || run.article?.status !== 'publication_ready' || run.qa?.passed !== true) {
    throw new Error(`${idea.id} research is not independently validated and publication-ready`);
  }
  if (!run.qa.reviewerId || run.qa.reviewerId === run.draftAuthor || run.qa.blockers?.length) {
    throw new Error(`${idea.id} lacks clean independent QA separation`);
  }
  const receiptPath = path.join(webRoot, run.qa.receiptPath);
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  if (receipt.verdict !== 'passed' || receipt.runId !== run.runId || receipt.articleSlug !== run.article.slug ||
      receipt.reviewerId !== run.qa.reviewerId || receipt.blockers?.length) {
    throw new Error(`${idea.id} QA receipt does not bind the promoted run cleanly`);
  }
  const reviewable = structuredClone(run);
  delete reviewable.qa;
  delete reviewable.completedAt;
  reviewable.status = 'review_pending';
  reviewable.article.status = 'review_pending';
  if (receipt.evidenceSha256 !== sha256(`${JSON.stringify(reviewable)}\n`)) {
    throw new Error(`${idea.id} evidence changed after independent review`);
  }
  const articlePath = path.join(webRoot, 'src', 'data', 'blog', `${run.article.slug}.md`);
  const articleRaw = await fs.readFile(articlePath, 'utf8');
  const reviewableArticle = articleRaw.replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending');
  if (receipt.articleSha256 !== sha256(reviewableArticle)) {
    throw new Error(`${idea.id} article changed after independent review`);
  }
  const socialPath = path.join(webRoot, 'social', 'drafts', `${run.article.slug}-launch.json`);
  let socialSha256 = null;
  try { socialSha256 = sha256(await fs.readFile(socialPath)); } catch {}
  if (receipt.socialSha256 !== socialSha256) {
    throw new Error(`${idea.id} social package changed after independent review`);
  }
  completedRuns.push({ ideaId: idea.id, ideaRevision: idea.revision, ideaSha256, runId: run.runId });
}

console.log(JSON.stringify({
  gate: 'passed',
  changeType: 'completed_batch',
  launchResearch: false,
  completedRuns
}, null, 2));
