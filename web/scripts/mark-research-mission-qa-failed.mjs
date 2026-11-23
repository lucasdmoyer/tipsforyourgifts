import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { assertReviewReceiptIdentity, receiptMatchesCurrentContent } from './lib/editorial-review-receipt-contract.mjs';
import { researchMissionSchema, reviewReceiptBelongsToMission, sha256 } from './lib/research-mission-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const missionId = args['mission-id'];
const runId = args['run-id'];
const reviewPath = args['receipt-path'];
if (!missionId || !runId || !reviewPath) throw new Error('Usage: node scripts/mark-research-mission-qa-failed.mjs --mission-id=<id> --run-id=<id> --receipt-path=<path> [--failed-at=<ISO>]');

const root = process.cwd();
const missionPath = path.join(root, 'research', 'missions', `${missionId}.json`);
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
if (mission.status !== 'started' || mission.researchFailureHandoff !== null || mission.qaFailureHandoff !== null || mission.visualHandoff !== null || mission.completion !== null) throw new Error('Only a started mission can record its initial QA failure');

const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const runRaw = await fs.readFile(runPath);
const run = JSON.parse(runRaw);
if (!['drafted', 'qa_failed'].includes(run.status) || run.article?.status !== 'draft' || run.qa?.passed !== false) throw new Error('QA failure handoff requires one unpromoted draft bundle');
if (run.ideaId !== mission.idea.id || run.ideaRevision !== mission.idea.revision || run.ideaSha256 !== mission.idea.sha256) throw new Error('Research bundle is not bound to the mission idea');

const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`));
const socialRaw = await fs.readFile(path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`));
const social = JSON.parse(socialRaw);
if (social.researchRun !== runId) throw new Error('Social launch pack is not bound to the QA-failed run');

const reviewRaw = await fs.readFile(path.join(root, reviewPath));
const review = assertReviewReceiptIdentity(JSON.parse(reviewRaw), reviewPath);
if (review.verdict !== 'failed' || review.blockers.length === 0) throw new Error('QA failure handoff requires a failed independent receipt with specific blockers');
if (!receiptMatchesCurrentContent({ receipt: review, run, articleRaw, socialRaw })) throw new Error('Independent review receipt is stale for the QA failure handoff');
if (!reviewReceiptBelongsToMission(review, mission)) throw new Error('Independent review receipt does not belong to the mission');

const failedAt = args['failed-at'] ?? new Date().toISOString();
mission.status = 'qa_failed';
mission.failedAt = failedAt;
mission.teamStages = [
  { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'completed' },
  { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'blocked' },
  { id: 'visual_production', role: 'visual-production-team', authority: 'original_assets_and_visual_receipt_only', status: 'queued' },
  { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
  { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
];
mission.qaFailureHandoff = {
  runId,
  runSha256: sha256(runRaw),
  articleSlug: run.article.slug,
  articleSha256: sha256(articleRaw),
  socialPackId: social.packId,
  socialPackSha256: sha256(socialRaw),
  reviewReceiptPath: reviewPath,
  reviewReceiptSha256: sha256(reviewRaw),
  reviewerId: review.reviewerId,
  reviewedAt: review.reviewedAt,
  blockers: review.blockers,
  warnings: review.warnings,
  nextGate: `Open the correction pull request for ${missionId}, revise only the evidence-bound draft bundle, and require a new independent review receipt before visual production or promotion.`
};
researchMissionSchema.parse(mission);
const raw = `${JSON.stringify(mission, null, 2)}\n`;
await fs.writeFile(missionPath, raw);
const missionSha256 = sha256(raw);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `mission_sha256=${missionSha256}\nmission_status=qa_failed\n`);
console.log(JSON.stringify({ missionId, status: mission.status, runId, articleSlug: run.article.slug, reviewReceiptPath: reviewPath, blockers: review.blockers.length, missionSha256, productionAuthorized: false }, null, 2));
