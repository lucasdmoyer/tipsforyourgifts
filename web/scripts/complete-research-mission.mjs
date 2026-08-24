import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { researchMissionSchema, sha256 } from './lib/research-mission-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
if (!args['mission-id'] || !args['run-id']) throw new Error('Usage: node scripts/complete-research-mission.mjs --mission-id=<id> --run-id=<id> [--completed-at=<ISO>]');

const root = process.cwd();
const missionPath = path.join(root, 'research/missions', `${args['mission-id']}.json`);
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
if (mission.status !== 'started' || mission.completion !== null) throw new Error('Only a started mission can be completed');
const runPath = path.join(root, 'research/runs', `${args['run-id']}.json`);
const runRaw = await fs.readFile(runPath);
const run = JSON.parse(runRaw);
if (run.status !== 'validated' || run.article.status !== 'publication_ready' || !run.qa?.passed) throw new Error('Mission completion requires one independently validated publication-ready run');
if (run.ideaId !== mission.idea.id || run.ideaRevision !== mission.idea.revision || run.ideaSha256 !== mission.idea.sha256) throw new Error('Research run is not bound to the mission idea');
const articlePath = path.join(root, 'src/data/blog', `${run.article.slug}.md`);
const articleRaw = await fs.readFile(articlePath);
const socialPath = path.join(root, 'social/drafts', `${run.article.slug}-launch.json`);
const socialRaw = await fs.readFile(socialPath);
const social = JSON.parse(socialRaw);
if (social.researchRun !== run.runId) throw new Error('Social launch pack is not bound to the mission run');
const reviewPath = path.join(root, run.qa.receiptPath);
const reviewRaw = await fs.readFile(reviewPath);
const review = JSON.parse(reviewRaw);
if (review.verdict !== 'passed' || review.blockers.length > 0 || review.runId !== run.runId) throw new Error('Independent review did not pass cleanly');
if (review.workflowRunId !== mission.trigger.workflowRunId) throw new Error('Review receipt does not belong to this mission workflow run');

const completedAt = args['completed-at'] ?? new Date().toISOString();
const automatic = mission.publicationPolicySnapshot.automaticPromotionEnabled;
mission.status = 'completed';
mission.completedAt = completedAt;
mission.teamStages = [
  { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'completed' },
  { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'completed' },
  { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'ready' },
  { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
];
mission.completion = {
  runId: run.runId,
  runSha256: sha256(runRaw),
  articleSlug: run.article.slug,
  articleSha256: sha256(articleRaw),
  socialPackId: social.packId,
  socialPackSha256: sha256(socialRaw),
  reviewReceiptPath: run.qa.receiptPath,
  reviewReceiptSha256: sha256(reviewRaw),
  publicationReadiness: automatic ? 'automatic_merge_eligible' : 'founder_review_required',
  nextGate: automatic
    ? 'Open the exact-SHA pull request and allow required checks plus the configured automatic merge policy to decide promotion.'
    : 'Open the exact-SHA pull request, review its Firebase preview and rollback evidence, then make the founder merge decision.'
};
researchMissionSchema.parse(mission);
const raw = `${JSON.stringify(mission, null, 2)}\n`;
await fs.writeFile(missionPath, raw);
const missionSha256 = sha256(raw);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `mission_sha256=${missionSha256}\npublication_readiness=${mission.completion.publicationReadiness}\n`);
console.log(JSON.stringify({ missionId: mission.missionId, status: mission.status, runId: run.runId, articleSlug: run.article.slug, publicationReadiness: mission.completion.publicationReadiness, missionSha256 }, null, 2));
