import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import {
  claimBindingsForRun,
  editorialSafetyApprovalSchema,
  reviewedContentDigests
} from './lib/editorial-safety-contract.mjs';
import {
  editorialReviewReceiptSchema,
  nextReviewRevision,
  reviewReceiptFilename
} from './lib/editorial-review-receipt-contract.mjs';

const run = {
  runId: '20261122-editorial-recheck-ab12cd34',
  ideaId: 'founder-idea-999',
  draftAuthor: 'research-drafter-fixture',
  status: 'qa_failed',
  article: { slug: 'editorial-recheck-fixture', status: 'draft' },
  claims: [{ id: 'claim-current-safety', text: 'Use only the current official product label and stop when the recipient reports discomfort.', sourceIds: ['src-official-label'], risk: 'high' }],
  qa: {
    passed: false,
    reviewerRole: 'independent-editor',
    reviewerId: 'pending-independent-review',
    receiptPath: 'research/reviews/20261122-editorial-recheck-ab12cd34.qa.v1.json',
    blockers: ['Founder safety review and a fresh independent evidence review are required.'],
    warnings: []
  }
};
const articleRaw = Buffer.from('---\nstatus: draft\n---\n\nUse only the current official product label.\n');
const socialRaw = Buffer.from('{"posts":[]}\n');
const approval = editorialSafetyApprovalSchema.parse({
  schemaVersion: '1.0.0',
  approvalId: `${run.runId}-founder-safety-v1`,
  approvalRevision: 1,
  runId: run.runId,
  articleSlug: run.article.slug,
  reviewedAt: '2026-11-22T12:00:00.000Z',
  approverLogin: 'lucasdmoyer',
  workflow: { name: 'editorial-safety-approval.yml', runId: '12345', runAttempt: 1, actor: 'lucasdmoyer' },
  decision: 'approved',
  reviewedContentSha256: reviewedContentDigests({ run, articleRaw, socialRaw }),
  highRiskClaims: claimBindingsForRun(run),
  acknowledgements: {
    exactReaderLanguageReviewed: true,
    notFirstHandProductTesting: true,
    independentQaStillRequired: true,
    publicationNotAuthorized: true
  }
});

assert.equal(nextReviewRevision([], run.runId), 1);
assert.equal(nextReviewRevision([reviewReceiptFilename(run.runId, 1), reviewReceiptFilename(run.runId, 3)], run.runId), 4);
assert.throws(() => editorialReviewReceiptSchema.parse({
  schemaVersion: '1.1.0', receiptId: `${run.runId}-qa-v1`, receiptRevision: 1, runId: run.runId, articleSlug: run.article.slug,
  reviewedAt: '2026-11-22T12:00:00.000Z', reviewerRole: 'independent-editor', reviewerId: 'reviewer-fixture', workflowRunId: '12345', verdict: 'passed',
  evidenceSha256: 'a'.repeat(64), articleSha256: 'b'.repeat(64), socialSha256: null, blockers: ['A passing review cannot retain this blocker.'], warnings: []
}));

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-editorial-recheck-'));
try {
  await fs.mkdir(path.join(fixtureRoot, 'research', 'runs'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'research', 'reviews'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'research', 'safety-approvals'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'src', 'data', 'blog'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'social', 'drafts'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'research', 'runs', `${run.runId}.json`), `${JSON.stringify(run, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'research', 'safety-approvals', `${run.runId}.founder-safety.v1.json`), `${JSON.stringify(approval, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'src', 'data', 'blog', `${run.article.slug}.md`), articleRaw);
  await fs.writeFile(path.join(fixtureRoot, 'social', 'drafts', `${run.article.slug}-launch.json`), socialRaw);

  const resolveScript = path.resolve('scripts/resolve-editorial-review-target.mjs');
  const createScript = path.resolve('scripts/create-review-receipt.mjs');
  const promoteScript = path.resolve('scripts/promote-reviewed-run.mjs');
  const resolveOutput = path.join(fixtureRoot, 'resolve-output.txt');
  const resolved = spawnSync(process.execPath, [resolveScript, `--run-id=${run.runId}`], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: resolveOutput }
  });
  assert.equal(resolved.status, 0, resolved.stderr || resolved.stdout);
  assert.match(await fs.readFile(resolveOutput, 'utf8'), /eligible=true/);
  assert.match(await fs.readFile(resolveOutput, 'utf8'), new RegExp(`expected_receipt_path=research/reviews/${run.runId}\\.qa\\.v1\\.json`));

  const failedFindings = path.join(fixtureRoot, 'failed-findings.json');
  await fs.writeFile(failedFindings, `${JSON.stringify({ schemaVersion: '1.0.0', runId: run.runId, verdict: 'failed', blockers: ['The exact current source does not support one material reader-facing claim.'], warnings: [] }, null, 2)}\n`);
  const failed = spawnSync(process.execPath, [createScript, `--run-id=${run.runId}`, '--reviewer-id=evidence-red-team-12345', '--workflow-name=editorial-independent-review.yml', '--workflow-run-id=12345', `--findings-file=${failedFindings}`, '--reviewed-at=2026-11-22T13:00:00.000Z'], { cwd: fixtureRoot, encoding: 'utf8' });
  assert.equal(failed.status, 0, failed.stderr || failed.stdout);
  const firstReceipt = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'research', 'reviews', reviewReceiptFilename(run.runId, 1)), 'utf8'));
  assert.equal(firstReceipt.receiptRevision, 1);
  assert.equal(firstReceipt.verdict, 'failed');
  assert.equal(firstReceipt.workflowName, 'editorial-independent-review.yml');
  assert.equal(firstReceipt.missionId, null);

  const blocked = spawnSync(process.execPath, [resolveScript, `--run-id=${run.runId}`], { cwd: fixtureRoot, encoding: 'utf8' });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /already_failed/);

  const passedFindings = path.join(fixtureRoot, 'passed-findings.json');
  await fs.writeFile(passedFindings, `${JSON.stringify({ schemaVersion: '1.0.0', runId: run.runId, verdict: 'passed', blockers: [], warnings: ['Recheck the current official label immediately before any later production release.'] }, null, 2)}\n`);
  const passed = spawnSync(process.execPath, [createScript, `--run-id=${run.runId}`, '--reviewer-id=evidence-red-team-67890', '--workflow-name=editorial-independent-review.yml', '--workflow-run-id=67890', `--findings-file=${passedFindings}`, '--reviewed-at=2026-11-22T14:00:00.000Z'], { cwd: fixtureRoot, encoding: 'utf8' });
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);
  const secondPath = `research/reviews/${reviewReceiptFilename(run.runId, 2)}`;
  const secondReceipt = JSON.parse(await fs.readFile(path.join(fixtureRoot, secondPath), 'utf8'));
  assert.equal(secondReceipt.receiptId, `${run.runId}-qa-v2`);
  assert.equal(secondReceipt.verdict, 'passed');

  const promoted = spawnSync(process.execPath, [promoteScript, run.runId, `--receipt-path=${secondPath}`], { cwd: fixtureRoot, encoding: 'utf8' });
  assert.equal(promoted.status, 0, promoted.stderr || promoted.stdout);
  const promotedRun = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'research', 'runs', `${run.runId}.json`), 'utf8'));
  assert.equal(promotedRun.status, 'validated');
  assert.equal(promotedRun.article.status, 'publication_ready');
  assert.equal(promotedRun.qa.receiptPath, secondPath);
  assert.equal(promotedRun.qa.reviewerId, 'evidence-red-team-67890');
  assert.match(await fs.readFile(path.join(fixtureRoot, 'src', 'data', 'blog', `${run.article.slug}.md`), 'utf8'), /^status: publication_ready$/m);
  await fs.access(path.join(fixtureRoot, 'research', 'reviews', reviewReceiptFilename(run.runId, 1)));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

const workflowRaw = await fs.readFile(path.resolve('../.github/workflows/editorial-independent-review.yml'), 'utf8');
const workflow = YAML.parse(workflowRaw);
assert.ok(workflow.jobs.independent_review);
assert.ok(workflow.jobs.propose_result);
assert.equal(workflow.permissions.contents, 'read');
assert.equal(workflow.jobs.propose_result.permissions.contents, 'write');
assert.match(workflowRaw, /web\/research\/safety-approvals\/\*\.json/);
assert.match(workflowRaw, /openai\/codex-action@v1/);
assert.match(workflowRaw, /editorial-review-result\.json/);
assert.match(workflowRaw, /git diff --name-only HEAD/);
assert.match(workflowRaw, /review:promote/);
assert.match(workflowRaw, /npm run validate/);
assert.match(workflowRaw, /npm run build/);
assert.match(workflowRaw, /npm run smoke/);
assert.match(workflowRaw, /gh pr create/);
assert.doesNotMatch(workflowRaw, /firebase deploy|gh pr merge/);

console.log(JSON.stringify({
  editorialRecheckGateTests: 'passed',
  immutableReceiptRevisions: 2,
  failedReceiptPreserved: true,
  exactPassingReceiptPromoted: true,
  workflowChecks: 12,
  productionAuthorized: false
}, null, 2));
