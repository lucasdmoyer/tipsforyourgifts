import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { researchMissionSchema, sha256 } from './lib/research-mission-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const missionId = args['mission-id'];
const reasonCode = args['reason-code'];
if (!missionId || !['model_step_failed', 'draft_bundle_invalid'].includes(reasonCode)) {
  throw new Error('Usage: node scripts/mark-research-mission-research-failed.mjs --mission-id=<id> --reason-code=model_step_failed|draft_bundle_invalid [--failed-at=<ISO>]');
}

const root = process.cwd();
const missionPath = path.join(root, 'research', 'missions', `${missionId}.json`);
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
if (mission.status !== 'started' || mission.researchFailureHandoff !== null || mission.reviewFailureHandoff !== null || mission.qaFailureHandoff !== null || mission.visualHandoff !== null || mission.completion !== null) {
  throw new Error('Only a pristine started mission can record a research execution failure');
}

mission.status = 'research_failed';
mission.failedAt = args['failed-at'] ?? new Date().toISOString();
mission.teamStages = [
  { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'blocked' },
  { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'queued' },
  { id: 'visual_production', role: 'visual-production-team', authority: 'original_assets_and_visual_receipt_only', status: 'queued' },
  { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
  { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
];
mission.researchFailureHandoff = {
  reasonCode,
  workflowRunUrl: `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${mission.trigger.workflowRunId}`,
  nextGate: `Open the research failure pull request for ${missionId}, inspect the credential-free workflow evidence, and retry only from a new workflow run after the ${reasonCode === 'model_step_failed' ? 'model execution failure' : 'invalid draft bundle'} is corrected.`
};

researchMissionSchema.parse(mission);
const raw = `${JSON.stringify(mission, null, 2)}\n`;
await fs.writeFile(missionPath, raw);
const missionSha256 = sha256(raw);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `mission_sha256=${missionSha256}\nmission_status=research_failed\n`);
console.log(JSON.stringify({ missionId, status: mission.status, reasonCode, workflowRunUrl: mission.researchFailureHandoff.workflowRunUrl, missionSha256, untrustedDraftPreserved: false, productionAuthorized: false }, null, 2));
