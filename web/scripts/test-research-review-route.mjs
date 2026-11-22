import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-review-route-'));
const missionId = 'research-mission-12345-1';
const ideaSha256 = 'a'.repeat(64);
const mission = {
  schemaVersion: '1.0.0', missionId, status: 'started', createdAt: '2026-11-22T12:00:00.000Z', completedAt: null,
  trigger: { type: 'approved_strategy_dispatch', workflow: 'research-agent.yml', workflowRunId: '12345', workflowRunAttempt: 1, actor: 'lucasdmoyer', baseSha: 'b'.repeat(40) },
  idea: { id: 'founder-idea-999', revision: 1, sha256: ideaSha256, title: 'A thoughtful safety handoff fixture', thesisType: 'recipient_friction' },
  teamStages: [
    { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'in_progress' },
    { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'queued' },
    { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
    { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
  ],
  deliverables: { researchRuns: 1, articles: 1, socialLaunchPacks: 1, independentReviewReceipts: 1 },
  qualityGates: {
    minimumResearchPasses: 3, minimumSourceClasses: 5, minimumFinalists: 5, minimumEditorialScore: 75,
    minimumEvidenceConfidence: 70, minimumThoughtfulnessScore: 15, minimumPairCoherenceScore: 80,
    independentReviewerRequired: true, affiliatePosture: 'enabled_registry_only'
  },
  publicationPolicySnapshot: { mode: 'founder_reviewed', automaticPromotionEnabled: false, verifiedSuccessfulReleaseCount: 0, minimumSuccessfulFounderReviewedReleases: 10 },
  completion: null
};

const run = {
  runId: '20261122-review-route-fixture-ab12cd34', ideaId: mission.idea.id, ideaRevision: mission.idea.revision, ideaSha256,
  status: 'drafted', article: { slug: 'review-route-fixture', status: 'draft' }, qa: { passed: false }, claims: []
};

try {
  await fs.mkdir(path.join(fixtureRoot, 'research', 'missions'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'research', 'runs'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'research', 'missions', `${missionId}.json`), `${JSON.stringify(mission, null, 2)}\n`);
  const runPath = path.join(fixtureRoot, 'research', 'runs', `${run.runId}.json`);
  const routeScript = path.resolve('scripts/resolve-research-review-route.mjs');

  await fs.writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`);
  const lowOutput = path.join(fixtureRoot, 'low-output.txt');
  const low = spawnSync(process.execPath, [routeScript, `--run-id=${run.runId}`, `--mission-id=${missionId}`], { cwd: fixtureRoot, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: lowOutput } });
  assert.equal(low.status, 0, low.stderr || low.stdout);
  assert.match(await fs.readFile(lowOutput, 'utf8'), /review_route=independent_review/);

  run.claims = [{ id: 'claim-high-risk', risk: 'high', text: 'Use only the current official safety instructions.', sourceIds: ['src-official'] }];
  await fs.writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`);
  const highOutput = path.join(fixtureRoot, 'high-output.txt');
  const high = spawnSync(process.execPath, [routeScript, `--run-id=${run.runId}`, `--mission-id=${missionId}`], { cwd: fixtureRoot, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: highOutput } });
  assert.equal(high.status, 0, high.stderr || high.stdout);
  assert.match(await fs.readFile(highOutput, 'utf8'), /review_route=founder_safety/);
  assert.match(await fs.readFile(highOutput, 'utf8'), /high_risk_claims=1/);

  run.ideaRevision = 2;
  await fs.writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`);
  const mismatched = spawnSync(process.execPath, [routeScript, `--run-id=${run.runId}`, `--mission-id=${missionId}`], { cwd: fixtureRoot, encoding: 'utf8' });
  assert.notEqual(mismatched.status, 0);
  assert.match(mismatched.stderr, /trusted mission idea/);
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

const researchWorkflowRaw = await fs.readFile(path.resolve('../.github/workflows/research-agent.yml'), 'utf8');
const researchWorkflow = YAML.parse(researchWorkflowRaw);
const reviewSteps = researchWorkflow.jobs.quality_review.steps;
const codexStep = reviewSteps.find((step) => step.uses === 'openai/codex-action@v1');
assert.equal(codexStep.if, "steps.identify.outputs.review_route == 'independent_review'");
assert.match(researchWorkflowRaw, /Preserve a high-risk draft for founder safety review/);
assert.match(researchWorkflowRaw, /No independent receipt was created/);
assert.match(researchWorkflowRaw, /High-risk drafts always require the protected founder safety decision; auto-merge is disabled/);
assert.match(researchWorkflowRaw, /--workflow-name=research-agent\.yml/);

const recheckWorkflowRaw = await fs.readFile(path.resolve('../.github/workflows/editorial-independent-review.yml'), 'utf8');
assert.match(recheckWorkflowRaw, /--workflow-name=editorial-independent-review\.yml/);
assert.match(recheckWorkflowRaw, /research:mission:complete/);
assert.doesNotMatch(researchWorkflowRaw, /firebase deploy|gh pr merge --admin/);

console.log(JSON.stringify({
  researchReviewRouteTests: 'passed',
  lowRiskRoute: 'independent_review',
  highRiskRoute: 'founder_safety',
  highRiskModelCallSkipped: true,
  postApprovalMissionCompletion: true,
  productionAuthorized: false
}, null, 2));
