import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { researchMissionSchema, sha256 } from './lib/research-mission-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const missionId = args['mission-id'];
const runId = args['run-id'];
const reasonCode = args['reason-code'];
if (!missionId || !runId || !['review_model_step_failed', 'review_result_invalid'].includes(reasonCode)) {
  throw new Error('Usage: node scripts/mark-research-mission-review-failed.mjs --mission-id=<id> --run-id=<id> --reason-code=review_model_step_failed|review_result_invalid [--failed-at=<ISO>]');
}

const root = process.cwd();
const missionPath = path.join(root, 'research', 'missions', `${missionId}.json`);
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
if (mission.status !== 'started' || mission.researchFailureHandoff !== null || mission.reviewFailureHandoff !== null || mission.qaFailureHandoff !== null || mission.visualHandoff !== null || mission.completion !== null) {
  throw new Error('Only a pristine started mission can record an independent-review execution failure');
}

const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const runRaw = await fs.readFile(runPath);
const run = JSON.parse(runRaw);
if (run.status !== 'drafted' || run.article?.status !== 'draft' || run.qa?.passed !== false) throw new Error('Review execution failure handoff requires one unpromoted draft bundle');
if (run.ideaId !== mission.idea.id || run.ideaRevision !== mission.idea.revision || run.ideaSha256 !== mission.idea.sha256) throw new Error('Research bundle is not bound to the mission idea');

const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`));
const socialRaw = await fs.readFile(path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`));
const social = JSON.parse(socialRaw);
if (social.researchRun !== runId) throw new Error('Social launch pack is not bound to the review-failed run');

mission.status = 'review_failed';
mission.failedAt = args['failed-at'] ?? new Date().toISOString();
mission.teamStages = [
  { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'completed' },
  { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'blocked' },
  { id: 'visual_production', role: 'visual-production-team', authority: 'original_assets_and_visual_receipt_only', status: 'queued' },
  { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
  { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
];
mission.reviewFailureHandoff = {
  runId,
  runSha256: sha256(runRaw),
  articleSlug: run.article.slug,
  articleSha256: sha256(articleRaw),
  socialPackId: social.packId,
  socialPackSha256: sha256(socialRaw),
  reasonCode,
  workflowRunUrl: `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${mission.trigger.workflowRunId}`,
  nextGate: `Open the independent-review failure pull request for ${missionId}, inspect the credential-free draft evidence, and retry only from a new workflow run after the ${reasonCode === 'review_model_step_failed' ? 'reviewer execution failure' : 'invalid reviewer result'} is corrected.`
};

researchMissionSchema.parse(mission);
const raw = `${JSON.stringify(mission, null, 2)}\n`;
await fs.writeFile(missionPath, raw);
const missionSha256 = sha256(raw);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `mission_sha256=${missionSha256}\nmission_status=review_failed\n`);
console.log(JSON.stringify({ missionId, status: mission.status, runId, articleSlug: run.article.slug, reasonCode, workflowRunUrl: mission.reviewFailureHandoff.workflowRunUrl, missionSha256, partialReviewPreserved: false, reviewReceiptCreated: false, productionAuthorized: false }, null, 2));
