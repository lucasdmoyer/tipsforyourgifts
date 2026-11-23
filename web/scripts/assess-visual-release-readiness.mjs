import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { assertReviewReceiptIdentity, receiptMatchesCurrentContent } from './lib/editorial-review-receipt-contract.mjs';
import { researchMissionSchema, reviewReceiptBelongsToMission } from './lib/research-mission-contract.mjs';
import { sha256, validateVisualRequestRecords } from './lib/visual-request-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const runId = args['run-id'];
const missionId = args['mission-id'];
if (!runId || !missionId) throw new Error('Usage: node scripts/assess-visual-release-readiness.mjs --run-id=<id> --mission-id=<id>');

const root = process.cwd();
const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const runRaw = await fs.readFile(runPath);
const run = JSON.parse(runRaw);
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'research', 'missions', `${missionId}.json`), 'utf8')));
if (mission.status !== 'started') throw new Error('Visual release assessment requires a started research mission');
if (!['drafted', 'qa_failed'].includes(run.status) || run.article?.status !== 'draft' || run.qa?.passed !== false) throw new Error('Visual release assessment requires one unpromoted draft bundle');
if (run.ideaId !== mission.idea.id || run.ideaRevision !== mission.idea.revision || run.ideaSha256 !== mission.idea.sha256) throw new Error('Research bundle is not bound to the trusted mission idea');

const articlePath = path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`);
const articleRaw = await fs.readFile(articlePath);
const article = matter(articleRaw.toString('utf8'));
const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
let socialRaw = null;
try { socialRaw = await fs.readFile(socialPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const receiptPath = args['receipt-path'] || run.qa.receiptPath;
if (!receiptPath) throw new Error('Visual release assessment requires the exact independent review receipt path');
const receipt = assertReviewReceiptIdentity(JSON.parse(await fs.readFile(path.join(root, receiptPath), 'utf8')), receiptPath);
if (receipt.verdict !== 'passed' || receipt.blockers.length > 0) throw new Error('Editorial review must pass cleanly before visual release assessment');
if (!receiptMatchesCurrentContent({ receipt, run, articleRaw, socialRaw })) throw new Error('Editorial review receipt is stale for the current bundle');
if (!reviewReceiptBelongsToMission(receipt, mission)) throw new Error('Editorial review receipt does not belong to this research mission');

const registry = JSON.parse(await fs.readFile(path.join(root, 'visuals', 'article-visuals.json'), 'utf8'));
const visualArticleSlugs = new Set((registry.articles ?? []).map((entry) => entry.slug));
const requestPath = path.join(root, 'visuals', 'requests', `${runId}-visuals.json`);
let requestRaw = null;
try { requestRaw = await fs.readFile(requestPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }

let releaseRoute;
if (visualArticleSlugs.has(run.article.slug)) {
  if (requestRaw !== null) throw new Error('Approved visual mapping cannot coexist with a pending visual request');
  releaseRoute = 'publication_ready';
} else {
  if (requestRaw === null) throw new Error('Draft without approved visuals must include one pending visual request');
  const request = JSON.parse(requestRaw);
  const validation = validateVisualRequestRecords({
    records: [{ filename: path.basename(requestPath), raw: requestRaw, data: request }],
    articlesBySlug: new Map([[run.article.slug, { filename: `${run.article.slug}.md`, raw: articleRaw, data: article.data }]]),
    runsById: new Map([[runId, { filename: `${runId}.json`, raw: runRaw, data: run }]]),
    visualArticleSlugs
  });
  if (validation.issues.length > 0) throw new Error(`Pending visual request is invalid: ${validation.issues.join('; ')}`);
  releaseRoute = 'visual_pending';
}

const output = {
  runId,
  missionId,
  articleSlug: run.article.slug,
  releaseRoute,
  reviewReceiptPath: receiptPath,
  visualRequestPath: requestRaw === null ? null : path.relative(root, requestPath),
  visualRequestSha256: requestRaw === null ? null : sha256(requestRaw),
  promotionEligible: releaseRoute === 'publication_ready',
  publicationAuthorized: false,
  productionAuthorized: false
};
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, [
    `release_route=${releaseRoute}`,
    `visual_request_path=${output.visualRequestPath ?? ''}`,
    `visual_request_sha256=${output.visualRequestSha256 ?? ''}`,
    `review_receipt_path=${receiptPath}`,
    ''
  ].join('\n'));
}
console.log(JSON.stringify(output, null, 2));
