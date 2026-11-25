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
assert.ok(preflightStep && noDataStep && runtimeStep && credentialStep && modelStep, 'growth review needs data preflight, runtime, credential, and model steps');
assert.ok(position(preflightStep.name) < position(runtimeStep.name), 'data preflight must run before runtime authorization');
assert.ok(position(runtimeStep.name) < position(credentialStep.name), 'runtime authorization must run before credential access');
assert.ok(position(credentialStep.name) < position(modelStep.name), 'credential verification must precede the model call');
assert.equal(noDataStep.if, "steps.preflight.outputs.should_review != 'true'");
assert.equal(runtimeStep.if, "steps.preflight.outputs.should_review == 'true'");
assert.equal(credentialStep.if, "steps.preflight.outputs.should_review == 'true'");
assert.equal(modelStep.if, "steps.preflight.outputs.should_review == 'true'");
assert.equal(modelStep.uses, 'openai/codex-action@v1');

console.log(JSON.stringify({
  growthReviewReadinessTests: 'passed',
  noSnapshotStopsBeforeCredential: true,
  completeSnapshotAllowsReview: true,
  workflowOrderProtected: true,
  personalDataStored: false
}, null, 2));
