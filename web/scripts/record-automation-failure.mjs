import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { automationFailureMappings, automationFailureReceiptSchema } from './lib/automation-failure-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const workflowName = args.workflow;
const stage = args.stage;
const reasonCode = args['reason-code'];
const targetKind = args['target-kind'];
const targetId = args['target-id'];
const targetSha256 = args['target-sha256'];
const targetUrl = args['target-url'] || null;
const workflowRunId = process.env.GITHUB_RUN_ID ?? args['workflow-run-id'];
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? args['workflow-run-attempt'] ?? '1');
const actor = process.env.GITHUB_ACTOR ?? args.actor;
const baseSha = process.env.GITHUB_SHA ?? args['base-sha'];
const ref = process.env.GITHUB_REF ?? args.ref;
const eventName = process.env.GITHUB_EVENT_NAME ?? args['event-name'];
const mapping = automationFailureMappings[workflowName];
if (!mapping || mapping.stage !== stage || mapping.targetKind !== targetKind || !['runtime_policy_failed', 'credential_preflight_failed', 'model_step_failed', 'output_invalid'].includes(reasonCode) || !/^[1-9]\d*$/.test(workflowRunId ?? '') || !Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) {
  throw new Error('Usage: node scripts/record-automation-failure.mjs --workflow=<registered.yml> --stage=<registered-stage> --reason-code=<code> --target-kind=<registered-kind> --target-id=<id> --target-sha256=<sha256> --target-url=<url> --workflow-run-id=<id> --workflow-run-attempt=<n> --actor=<actor> --base-sha=<sha> --ref=<ref> --event-name=<event>');
}

const workflowSlug = workflowName.replace(/\.yml$/, '');
const failureId = `automation-failure-${workflowSlug}-run${workflowRunId}-attempt${workflowRunAttempt}`;
const receipt = automationFailureReceiptSchema.parse({
  schemaVersion: '1.0.0',
  failureId,
  status: 'retry_required',
  stage,
  reasonCode,
  recordedAt: args['recorded-at'] ?? new Date().toISOString(),
  workflow: {
    name: workflowName,
    runId: workflowRunId,
    runAttempt: workflowRunAttempt,
    eventName,
    actor,
    baseSha,
    ref,
    url: `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${workflowRunId}`
  },
  target: { kind: targetKind, id: targetId, sourceSha256: targetSha256, url: targetUrl },
  handling: {
    partialModelOutputPreserved: false,
    authoritativeProposalPreserved: false,
    reviewReceiptCreated: false,
    externalStateChanged: false,
    productionDeploymentAuthorized: false
  },
  nextGate: `Inspect the exact ${workflowName} run and retry ${stage.replaceAll('_', ' ')} from a new workflow attempt only after ${reasonCode.replaceAll('_', ' ')} is corrected; never reuse partial model output.`
});
const directory = path.join(process.cwd(), 'automation', 'failures');
await fs.mkdir(directory, { recursive: true });
const receiptPath = path.join(directory, `${failureId}.json`);
await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `failure_id=${failureId}\nfailure_path=web/automation/failures/${failureId}.json\n`);
console.log(JSON.stringify({ failureId, workflow: workflowName, stage, reasonCode, target: receipt.target, partialModelOutputPreserved: false, authoritativeProposalPreserved: false, reviewReceiptCreated: false, externalStateChanged: false, productionDeploymentAuthorized: false }, null, 2));
