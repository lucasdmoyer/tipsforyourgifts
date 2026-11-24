import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { opportunityScoutMissionSchema, sha256 } from './lib/opportunity-scout-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const scoutId = args['scout-id'];
const stage = args.stage;
const reasonCode = args['reason-code'];
const expectedMissionSha256 = args['expected-mission-sha256'];
const allowedReasons = stage === 'discovery'
  ? ['discovery_model_step_failed', 'discovery_bundle_invalid']
  : ['review_model_step_failed', 'review_result_invalid'];
if (!scoutId || !['discovery', 'independent_review'].includes(stage) || !allowedReasons.includes(reasonCode) || !/^[a-f0-9]{64}$/.test(expectedMissionSha256 ?? '')) {
  throw new Error('Usage: node scripts/mark-opportunity-scout-failed.mjs --scout-id=<id> --stage=<discovery|independent_review> --reason-code=<code> --expected-mission-sha256=<sha256>');
}

const root = process.cwd();
const exists = async (target) => fs.access(target).then(() => true).catch((error) => {
  if (error.code === 'ENOENT') return false;
  throw error;
});
const missionPath = path.join(root, 'research', 'opportunity-missions', `${scoutId}.json`);
const missionRaw = await fs.readFile(missionPath);
if (sha256(missionRaw) !== expectedMissionSha256) throw new Error('Opportunity mission differs from the trusted start envelope');
const mission = opportunityScoutMissionSchema.parse(JSON.parse(missionRaw));
if (mission.status !== 'started' || mission.failureHandoff !== null || mission.completion !== null) throw new Error('Only a clean started opportunity mission can fail');
if (await exists(path.join(root, 'research', 'opportunities', `${scoutId}.json`))) {
  throw new Error('Unreviewed opportunity report must not be preserved in a failure packet');
}
if (await exists(path.join(root, 'research', 'opportunity-reviews', `${scoutId}.qa.v1.json`))) {
  throw new Error('A failure packet must not contain a review receipt');
}
const strategy = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'strategy.json'), 'utf8'));
if (strategy.ideas.some((idea) => idea.id === mission.expectedProposalId)) throw new Error('Unreviewed strategy proposal must not be preserved in a failure packet');

const recordedAt = args['recorded-at'] ?? new Date().toISOString();
mission.status = stage === 'discovery' ? 'discovery_failed' : 'review_failed';
mission.failedAt = recordedAt;
mission.failureHandoff = {
  stage,
  reasonCode,
  recordedAt,
  startedMissionSha256: expectedMissionSha256,
  workflowRunId: mission.trigger.workflowRunId,
  workflowRunAttempt: mission.trigger.workflowRunAttempt,
  workflowRunUrl: `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${mission.trigger.workflowRunId}`,
  partialOutputPreserved: false,
  proposalPreserved: false,
  reviewReceiptCreated: false,
  productionDeploymentAuthorized: false,
  nextGate: `Inspect the exact ${stage.replace('_', ' ')} workflow failure, correct ${reasonCode.replaceAll('_', ' ')}, and start a new opportunity-scout run without reusing unreviewed model output.`
};
opportunityScoutMissionSchema.parse(mission);
const raw = `${JSON.stringify(mission, null, 2)}\n`;
await fs.writeFile(missionPath, raw);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `mission_status=${mission.status}\nmission_sha256=${sha256(raw)}\n`);
console.log(JSON.stringify({ scoutId, status: mission.status, stage, reasonCode, missionSha256: sha256(raw), partialOutputPreserved: false, proposalPreserved: false, reviewReceiptCreated: false, productionAuthorized: false }, null, 2));
