import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { sha256, visualProductionDirectory, visualProductionManifestSchema, visualReviewFindingsSchema } from './lib/visual-production-contract.mjs';
import { visualFailureReceiptSchema } from './lib/visual-failure-contract.mjs';
import { loadVisualProductionTarget } from './lib/visual-production-store.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const requestId = args['request-id'];
const stage = args.stage;
const reasonCode = args['reason-code'];
const workflowRunId = process.env.GITHUB_RUN_ID ?? args['workflow-run-id'];
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? args['workflow-run-attempt'] ?? '1');
if (!requestId || !['production', 'independent_review'].includes(stage) || !['production_step_failed', 'production_bundle_invalid', 'review_step_failed', 'review_findings_invalid', 'review_verdict_failed'].includes(reasonCode) || !/^[1-9]\d*$/.test(workflowRunId ?? '') || !Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) {
  throw new Error('Usage: node scripts/record-visual-production-failure.mjs --request-id=<id> --stage=<production|independent_review> --reason-code=<code> --workflow-run-id=<id> [--workflow-run-attempt=<n>]');
}

const root = process.cwd();
const { target } = await loadVisualProductionTarget(root, requestId);
if (!target) throw new Error(`Visual request is not currently eligible: ${requestId}`);
const evidence = { manifestSha256: null, findingsSha256: null, reviewVerdict: null, blockers: [], warnings: [] };
const productionDirectory = path.join(root, visualProductionDirectory(requestId));
if (reasonCode === 'review_verdict_failed') {
  const manifestRaw = await fs.readFile(path.join(productionDirectory, 'manifest.json'));
  const findingsRaw = await fs.readFile(path.join(productionDirectory, 'visual-review-findings.json'));
  const manifest = visualProductionManifestSchema.parse(JSON.parse(manifestRaw));
  const findings = visualReviewFindingsSchema.parse(JSON.parse(findingsRaw));
  if (manifest.requestId !== requestId || findings.requestId !== requestId || findings.verdict !== 'failed' || findings.manifestSha256 !== sha256(manifestRaw)) throw new Error('Failed visual-review evidence is not exact');
  evidence.manifestSha256 = sha256(manifestRaw);
  evidence.findingsSha256 = sha256(findingsRaw);
  evidence.reviewVerdict = 'failed';
  evidence.blockers = [...new Set([
    ...findings.blockers,
    ...findings.assets.flatMap((asset) => [
      ...asset.blockers.map((blocker) => `${asset.assetId}: ${blocker}`),
      ...Object.entries(asset.checks).filter(([, passed]) => !passed).map(([check]) => `${asset.assetId}: ${check} failed the independent visual review.`)
    ])
  ])];
  evidence.warnings = findings.warnings;
  if (evidence.blockers.length === 0) throw new Error('Failed visual review did not preserve a concrete blocker');
}

const failureId = `${requestId}-run${workflowRunId}-attempt${workflowRunAttempt}`;
const receipt = visualFailureReceiptSchema.parse({
  schemaVersion: '1.0.0', failureId, status: 'retry_required', stage, reasonCode,
  recordedAt: args['recorded-at'] ?? new Date().toISOString(),
  workflow: { name: 'visual-production.yml', runId: workflowRunId, runAttempt: workflowRunAttempt, url: `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${workflowRunId}` },
  bindings: {
    requestId, requestPath: target.requestRecord.path, requestSha256: target.requestRecord.sha256,
    missionId: target.missionRecord.data.missionId, missionPath: target.missionRecord.path, missionSha256: target.missionRecord.sha256,
    runId: target.runRecord.data.runId, articleSlug: target.requestRecord.data.articleSlug
  },
  evidence,
  handling: { partialOutputPreserved: false, generatedAssetsPromoted: false, reviewReceiptCreated: false, productionDeploymentAuthorized: false },
  nextGate: `Open the visual-failure correction pull request for ${requestId}, inspect the exact workflow evidence, and retry visual production only after ${reasonCode.replaceAll('_', ' ')} is corrected.`
});
const failuresDirectory = path.join(root, 'visuals', 'failures');
await fs.mkdir(failuresDirectory, { recursive: true });
const receiptPath = path.join(failuresDirectory, `${failureId}.json`);
await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
await fs.rm(productionDirectory, { recursive: true, force: true });
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `failure_id=${failureId}\nfailure_path=web/visuals/failures/${failureId}.json\n`);
console.log(JSON.stringify({ failureId, requestId, stage, reasonCode, receiptPath: `visuals/failures/${failureId}.json`, partialOutputPreserved: false, generatedAssetsPromoted: false, reviewReceiptCreated: false, productionAuthorized: false }, null, 2));
