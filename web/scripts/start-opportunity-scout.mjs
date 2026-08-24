import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { nextStrategyIdeaId, opportunityScoutMissionSchema, opportunityScoutPolicySchema, sha256 } from './lib/opportunity-scout-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const required = ['base-sha', 'workflow-run-id', 'workflow-run-attempt', 'actor', 'trigger'];
for (const key of required) if (!args[key]) throw new Error(`Missing --${key}=...`);
if (!/^[a-f0-9]{40}$/.test(args['base-sha'])) throw new Error('Base SHA must be an exact 40-character Git commit SHA');
if (!/^[1-9]\d*$/.test(args['workflow-run-id'])) throw new Error('Workflow run ID must be a positive integer');
const workflowRunAttempt = Number(args['workflow-run-attempt']);
if (!Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Workflow run attempt must be a positive integer');
if (!/^[A-Za-z0-9-]+(?:\[bot\])?$/.test(args.actor)) throw new Error('Actor must be a GitHub login or bot actor');
if (!['scheduled', 'manual'].includes(args.trigger)) throw new Error('Trigger must be scheduled or manual');

const root = process.cwd();
const [policy, strategy] = await Promise.all([
  fs.readFile(path.join(root, 'config/opportunity-scout-policy.json'), 'utf8').then(JSON.parse).then((value) => opportunityScoutPolicySchema.parse(value)),
  fs.readFile(path.join(root, 'src/data/strategy.json'), 'utf8').then(JSON.parse)
]);
const openProposalCount = strategy.ideas.filter((idea) => idea.founderDisposition === 'proposed').length;
const shouldScout = policy.enabled && openProposalCount < policy.maxOpenProposals;
const reason = !policy.enabled ? 'policy_disabled' : openProposalCount >= policy.maxOpenProposals ? 'founder_backlog_full' : 'capacity_available';

async function writeOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  await fs.appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

if (!shouldScout) {
  await writeOutputs({ should_scout: 'false', reason, open_proposal_count: openProposalCount });
  console.log(JSON.stringify({ shouldScout, reason, openProposalCount, maximumOpenProposals: policy.maxOpenProposals, externalWritesAttempted: false }, null, 2));
} else {
  const missionId = `opportunity-scout-${args['workflow-run-id']}-${workflowRunAttempt}`;
  const policySnapshot = structuredClone(policy);
  delete policySnapshot.updatedAt;
  const mission = opportunityScoutMissionSchema.parse({
    schemaVersion: '1.0.0',
    missionId,
    status: 'started',
    createdAt: args['created-at'] ?? new Date().toISOString(),
    completedAt: null,
    trigger: {
      type: args.trigger,
      workflow: 'opportunity-scout.yml',
      workflowRunId: args['workflow-run-id'],
      workflowRunAttempt,
      actor: args.actor,
      baseSha: args['base-sha']
    },
    expectedProposalId: nextStrategyIdeaId(strategy.ideas),
    openProposalCountAtStart: openProposalCount,
    authority: {
      mayAppendOneProposedIdea: true,
      mayApproveResearch: false,
      mayPublish: false,
      mayChangeAccountsOrSpend: false
    },
    policySnapshot,
    completion: null
  });
  const directory = path.join(root, 'research/opportunity-missions');
  const outputPath = path.join(directory, `${missionId}.json`);
  await fs.mkdir(directory, { recursive: true });
  const raw = `${JSON.stringify(mission, null, 2)}\n`;
  await fs.writeFile(outputPath, raw, { flag: 'wx' });
  const missionSha256 = sha256(raw);
  await writeOutputs({
    should_scout: 'true',
    reason,
    open_proposal_count: openProposalCount,
    mission_id: missionId,
    mission_path: `web/research/opportunity-missions/${missionId}.json`,
    mission_sha256: missionSha256,
    expected_proposal_id: mission.expectedProposalId
  });
  console.log(JSON.stringify({ shouldScout, reason, openProposalCount, missionId, missionPath: `research/opportunity-missions/${missionId}.json`, missionSha256, expectedProposalId: mission.expectedProposalId, externalWritesAttempted: false }, null, 2));
}
