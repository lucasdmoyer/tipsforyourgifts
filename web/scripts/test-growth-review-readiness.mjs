import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';
import { assessGrowthReviewReadiness } from './check-growth-review-readiness.mjs';

const growth = JSON.parse(await fs.readFile(path.join(process.cwd(), 'src', 'data', 'growth.json'), 'utf8'));
const noData = assessGrowthReviewReadiness(growth);
assert.deepEqual(noData, {
  shouldReview: false,
  reason: 'no_complete_aggregate_snapshot',
  snapshotCount: 0,
  latestSnapshotId: null,
  latestSnapshotSha256: null,
  latestSnapshotUrl: null,
  modelInvocationAuthorized: false
});

const withSnapshot = structuredClone(growth);
withSnapshot.snapshots.push({
  id: 'growth-snapshot-20261122-search-console',
  source: 'search_console_export',
  periodStart: '2026-11-15',
  periodEnd: '2026-11-21',
  collectedAt: '2026-11-22T18:00:00.000Z',
  reportingWindowDays: 7,
  sourceConnectorIds: ['search-console'],
  sourceEvidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345',
  sourceArtifactSha256: 'a'.repeat(64),
  articles: [{
    slug: 'read-it-then-play-it-gift-pairs',
    searchImpressions: 120,
    organicClicks: 9,
    engagedSessions: null,
    outboundMerchantClicks: null,
    affiliateConversions: null,
    revenueUsd: null,
    socialImpressions: null,
    socialEngagements: null,
    ownedSiteClicks: null
  }]
});
const observed = assessGrowthReviewReadiness(withSnapshot);
assert.equal(observed.shouldReview, true);
assert.equal(observed.reason, 'complete_aggregate_snapshot_available');
assert.equal(observed.snapshotCount, 1);
assert.equal(observed.latestSnapshotId, 'growth-snapshot-20261122-search-console');
assert.match(observed.latestSnapshotSha256, /^[a-f0-9]{64}$/);
assert.equal(observed.latestSnapshotUrl, 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345');
assert.equal(observed.modelInvocationAuthorized, true);

assert.throws(
  () => assessGrowthReviewReadiness({ ...growth, snapshots: [{}] }),
  /invalid|expected|string|number/i
);

const workflow = parse(await fs.readFile(path.join(process.cwd(), '..', '.github', 'workflows', 'growth-review.yml'), 'utf8'));
const steps = workflow.jobs.analyze.steps;
const step = (name) => steps.find((entry) => entry.name === name);
const position = (name) => steps.findIndex((entry) => entry.name === name);
const preflightStep = step('Stop before credentials when no complete aggregate snapshot exists');
const noDataStep = step('Record the no-data posture');
const runtimeStep = step('Authorize AI automation runtime');
const credentialStep = step('Verify autonomous agent credential');
const modelStep = step('Let the growth team propose the next measured experiment');
const boundaryStep = step('Prove the AI patch stayed inside the proposal boundary');
const routeStep = step('Route the exact growth-analysis result');
const failureJob = workflow.jobs.record_failure;
const failureWriterJob = workflow.jobs.open_failure_pull_request;
assert.ok(preflightStep && noDataStep && runtimeStep && credentialStep && modelStep && boundaryStep && routeStep, 'growth review needs data preflight, runtime, credential, model, boundary, and routing steps');
assert.ok(failureJob && failureWriterJob, 'growth review needs a credential-free failure recorder and detached correction writer');
assert.ok(position(preflightStep.name) < position(runtimeStep.name), 'data preflight must run before runtime authorization');
assert.ok(position(runtimeStep.name) < position(credentialStep.name), 'runtime authorization must run before credential access');
assert.ok(position(credentialStep.name) < position(modelStep.name), 'credential verification must precede the model call');
assert.equal(noDataStep.if, "steps.preflight.outputs.should_review != 'true'");
assert.equal(runtimeStep.if, "steps.preflight.outputs.should_review == 'true'");
assert.equal(credentialStep.if, "steps.preflight.outputs.should_review == 'true'");
assert.equal(modelStep.if, "steps.preflight.outputs.should_review == 'true'");
assert.equal(modelStep.uses, 'openai/codex-action@v1');
assert.equal(modelStep['continue-on-error'], true, 'a growth model failure must reach the trusted classifier');
assert.match(boundaryStep.if, /growth_agent\.outcome == 'success'/, 'the proposal boundary must run only after a successful model step');
assert.match(routeStep.run, /runtime_policy_failed[\s\S]*credential_preflight_failed[\s\S]*model_step_failed[\s\S]*output_invalid/, 'growth failures must be classified without inventing a result');
assert.equal(failureJob.steps.filter((entry) => entry.uses === 'openai/codex-action@v1').length, 0, 'growth failure recording must be credential-free');
assert.equal(failureWriterJob.steps.filter((entry) => entry.uses === 'openai/codex-action@v1').length, 0, 'growth correction writing must be credential-free');
const failureRecordStep = failureJob.steps.find((entry) => entry.name === 'Record only the credential-free growth failure receipt');
const failureProofStep = failureJob.steps.find((entry) => entry.name === 'Prove and serialize the clean growth failure packet');
const failurePrStep = failureWriterJob.steps.find((entry) => entry.name === 'Open the growth correction pull request with auto-merge disabled');
assert.ok(failureRecordStep && failureProofStep && failurePrStep, 'growth failure handling must preserve one complete retry packet');
assert.match(failureRecordStep.run, /automation:failure:record[\s\S]*--workflow=growth-review\.yml[\s\S]*--target-kind=growth_snapshot/, 'growth failure state must be created only by the deterministic recorder');
assert.match(failureProofStep.run, /git diff --exit-code HEAD -- web\/src\/data\/growth\.json/, 'growth failure recording must prove no experiment or metric change survived');
assert.match(failurePrStep.run, /does not preserve partial model output, a growth experiment, or a review receipt/, 'growth correction PR must say partial output and invented experiments were discarded');
assert.match(failurePrStep.run, /does not infer missing metrics/, 'growth correction PR must preserve the aggregate-only measurement boundary');
assert.doesNotMatch(failurePrStep.run, /gh pr merge/, 'growth correction PR must never auto-merge');

console.log(JSON.stringify({
  growthReviewReadinessTests: 'passed',
  noSnapshotStopsBeforeCredential: true,
  completeSnapshotAllowsReview: true,
  workflowOrderProtected: true,
  cleanFailureHandoffProtected: true,
  partialModelOutputPreserved: false,
  growthLedgerChangedOnFailure: false,
  personalDataStored: false
}, null, 2));
