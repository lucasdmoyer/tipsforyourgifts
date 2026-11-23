import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { assertReviewReceiptIdentity, receiptMatchesCurrentContent } from './lib/editorial-review-receipt-contract.mjs';
import { researchMissionSchema, reviewReceiptBelongsToMission, sha256 } from './lib/research-mission-contract.mjs';
import { validateVisualRequestRecords } from './lib/visual-request-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const missionId = args['mission-id'];
const runId = args['run-id'];
if (!missionId || !runId) throw new Error('Usage: node scripts/mark-research-mission-visual-pending.mjs --mission-id=<id> --run-id=<id>');

const root = process.cwd();
const missionPath = path.join(root, 'research', 'missions', `${missionId}.json`);
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
if (mission.status !== 'started' || mission.researchFailureHandoff !== null || mission.qaFailureHandoff !== null || mission.visualHandoff !== null || mission.completion !== null) throw new Error('Only a started mission can enter visual production');

const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const runRaw = await fs.readFile(runPath);
const run = JSON.parse(runRaw);
if (!['drafted', 'qa_failed'].includes(run.status) || run.article?.status !== 'draft' || run.qa?.passed !== false) throw new Error('Visual handoff requires one unpromoted draft bundle');
if (run.ideaId !== mission.idea.id || run.ideaRevision !== mission.idea.revision || run.ideaSha256 !== mission.idea.sha256) throw new Error('Research bundle is not bound to the mission idea');

const articlePath = path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`);
const articleRaw = await fs.readFile(articlePath);
const article = matter(articleRaw.toString('utf8'));
const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
const socialRaw = await fs.readFile(socialPath);
const social = JSON.parse(socialRaw);
if (social.researchRun !== runId) throw new Error('Social launch pack is not bound to the visual-handoff run');

const reviewPath = args['receipt-path'] || run.qa.receiptPath;
if (!reviewPath) throw new Error('Visual handoff requires the exact independent review receipt path');
const reviewRaw = await fs.readFile(path.join(root, reviewPath));
const review = assertReviewReceiptIdentity(JSON.parse(reviewRaw), reviewPath);
if (review.verdict !== 'passed' || review.blockers.length > 0) throw new Error('Visual handoff requires a clean independent editorial review');
if (!receiptMatchesCurrentContent({ receipt: review, run, articleRaw, socialRaw })) throw new Error('Editorial review receipt is stale for the visual handoff');
if (!reviewReceiptBelongsToMission(review, mission)) throw new Error('Editorial review receipt does not belong to the mission');

const visualRequestPath = `visuals/requests/${runId}-visuals.json`;
const visualRequestRaw = await fs.readFile(path.join(root, visualRequestPath));
const visualRequest = JSON.parse(visualRequestRaw);
const registry = JSON.parse(await fs.readFile(path.join(root, 'visuals', 'article-visuals.json'), 'utf8'));
const visualArticleSlugs = new Set((registry.articles ?? []).map((entry) => entry.slug));
const requestValidation = validateVisualRequestRecords({
  records: [{ filename: path.basename(visualRequestPath), raw: visualRequestRaw, data: visualRequest }],
  articlesBySlug: new Map([[run.article.slug, { filename: `${run.article.slug}.md`, raw: articleRaw, data: article.data }]]),
  runsById: new Map([[runId, { filename: `${runId}.json`, raw: runRaw, data: run }]]),
  visualArticleSlugs
});
if (requestValidation.issues.length > 0) throw new Error(`Visual request cannot enter production: ${requestValidation.issues.join('; ')}`);

mission.status = 'visual_pending';
mission.teamStages = [
  { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'completed' },
  { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'completed' },
  { id: 'visual_production', role: 'visual-production-team', authority: 'original_assets_and_visual_receipt_only', status: 'in_progress' },
  { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
  { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
];
mission.visualHandoff = {
  runId,
  runSha256: sha256(runRaw),
  articleSlug: run.article.slug,
  articleSha256: sha256(articleRaw),
  socialPackId: social.packId,
  socialPackSha256: sha256(socialRaw),
  reviewReceiptPath: reviewPath,
  reviewReceiptSha256: sha256(reviewRaw),
  visualRequestPath,
  visualRequestSha256: sha256(visualRequestRaw),
  nextGate: visualRequest.nextGate
};
researchMissionSchema.parse(mission);
const raw = `${JSON.stringify(mission, null, 2)}\n`;
await fs.writeFile(missionPath, raw);
const missionSha256 = sha256(raw);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `mission_sha256=${missionSha256}\nmission_status=visual_pending\n`);
console.log(JSON.stringify({ missionId, status: mission.status, runId, articleSlug: run.article.slug, visualRequestPath, missionSha256, productionAuthorized: false }, null, 2));
