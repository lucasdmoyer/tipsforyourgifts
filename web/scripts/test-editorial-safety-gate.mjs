import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import {
  assessEditorialSafetyApproval,
  claimBindingsForRun,
  editorialSafetyApprovalSchema,
  requireCurrentFounderSafetyApproval,
  reviewedContentDigests
} from './lib/editorial-safety-contract.mjs';
import YAML from 'yaml';

const run = {
  runId: '20261122-safety-fixture-ab12cd34',
  ideaId: 'founder-idea-999',
  draftAuthor: 'research-writer-fixture',
  status: 'qa_failed',
  article: { slug: 'sample-safety-guide', status: 'draft' },
  claims: [{ id: 'claim-safety-boundary', text: 'Follow the current official label and keep all small parts away from children.', sourceIds: ['src-official-label'], risk: 'high' }],
  qa: { passed: false, blockers: ['Founder review is required for the exact reader-facing safety wording.'], warnings: [] }
};
const articleRaw = Buffer.from('---\nstatus: draft\n---\n\nFollow the current official label.\n');
const socialRaw = Buffer.from('{"posts":[]}\n');
const currentReviewedContentSha256 = reviewedContentDigests({ run, articleRaw, socialRaw });
const baseApproval = {
  schemaVersion: '1.0.0',
  approvalId: `${run.runId}-founder-safety-v1`,
  approvalRevision: 1,
  runId: run.runId,
  articleSlug: run.article.slug,
  reviewedAt: '2026-11-22T12:00:00.000Z',
  approverLogin: 'lucasdmoyer',
  workflow: { name: 'editorial-safety-approval.yml', runId: '12345', runAttempt: 1, actor: 'lucasdmoyer' },
  decision: 'approved',
  reviewedContentSha256: currentReviewedContentSha256,
  highRiskClaims: claimBindingsForRun(run),
  acknowledgements: {
    exactReaderLanguageReviewed: true,
    notFirstHandProductTesting: true,
    independentQaStillRequired: true,
    publicationNotAuthorized: true
  }
};

const approved = editorialSafetyApprovalSchema.parse(baseApproval);
assert.equal(assessEditorialSafetyApproval({ approval: approved, run, currentReviewedContentSha256 }).status, 'approved_current');
assert.equal(requireCurrentFounderSafetyApproval({ run, currentReviewedContentSha256, approvals: [approved] }).status, 'approved_current');

const rejected = editorialSafetyApprovalSchema.parse({ ...baseApproval, decision: 'rejected' });
assert.throws(() => requireCurrentFounderSafetyApproval({ run, currentReviewedContentSha256, approvals: [rejected] }), /founder rejected/);
assert.throws(() => requireCurrentFounderSafetyApproval({ run, currentReviewedContentSha256, approvals: [] }), /approval is required/);

const changedArticle = Buffer.from('---\nstatus: draft\n---\n\nChanged reader-facing safety language.\n');
const changedContent = reviewedContentDigests({ run, articleRaw: changedArticle, socialRaw });
assert.throws(() => requireCurrentFounderSafetyApproval({ run, currentReviewedContentSha256: changedContent, approvals: [approved] }), /stale/);

const changedRun = structuredClone(run);
changedRun.claims[0].text = 'Changed exact high-risk claim language that must receive a new decision.';
assert.throws(() => requireCurrentFounderSafetyApproval({ run: changedRun, currentReviewedContentSha256, approvals: [approved] }), /stale/);

const blockerWithoutClaim = structuredClone(run);
blockerWithoutClaim.claims[0].risk = 'medium';
assert.throws(() => requireCurrentFounderSafetyApproval({ run: blockerWithoutClaim, currentReviewedContentSha256, approvals: [] }), /blocker exists without/);

const ordinaryRun = structuredClone(blockerWithoutClaim);
ordinaryRun.qa.blockers = ['Independent evidence review is still required before promotion.'];
assert.equal(requireCurrentFounderSafetyApproval({ run: ordinaryRun, currentReviewedContentSha256, approvals: [] }).status, 'not_required');

assert.throws(() => editorialSafetyApprovalSchema.parse({ ...baseApproval, approverLogin: 'someone-else' }));
assert.throws(() => editorialSafetyApprovalSchema.parse({ ...baseApproval, workflow: { ...baseApproval.workflow, actor: 'someone-else' } }));
assert.throws(() => editorialSafetyApprovalSchema.parse({ ...baseApproval, unexpectedAuthority: true }));

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-editorial-safety-'));
try {
  await fs.mkdir(path.join(fixtureRoot, 'research', 'runs'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'src', 'data', 'blog'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'social', 'drafts'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'research', 'runs', `${run.runId}.json`), `${JSON.stringify(run, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'src', 'data', 'blog', `${run.article.slug}.md`), articleRaw);
  await fs.writeFile(path.join(fixtureRoot, 'social', 'drafts', `${run.article.slug}-launch.json`), socialRaw);
  const scriptPath = path.resolve('scripts/create-editorial-safety-approval.mjs');
  const common = [scriptPath, `--run-id=${run.runId}`, '--approver-login=lucasdmoyer', '--workflow-run-id=12345', '--workflow-run-attempt=1', '--actor=lucasdmoyer', '--reviewed-at=2026-11-22T12:00:00.000Z'];
  execFileSync(process.execPath, [...common, '--decision=approved'], { cwd: fixtureRoot, stdio: 'pipe' });
  execFileSync(process.execPath, [...common, '--decision=rejected'], { cwd: fixtureRoot, stdio: 'pipe' });
  const names = (await fs.readdir(path.join(fixtureRoot, 'research', 'safety-approvals'))).sort();
  assert.deepEqual(names, [`${run.runId}.founder-safety.v1.json`, `${run.runId}.founder-safety.v2.json`]);
  const second = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'research', 'safety-approvals', names[1]), 'utf8'));
  assert.equal(second.approvalRevision, 2);
  assert.equal(second.decision, 'rejected');
  assert.deepEqual(second.reviewedContentSha256, currentReviewedContentSha256);
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

const workflowPath = path.resolve('../.github/workflows/editorial-safety-approval.yml');
const workflowRaw = await fs.readFile(workflowPath, 'utf8');
const workflow = YAML.parse(workflowRaw);
const workflowText = JSON.stringify(workflow);
assert.match(workflowRaw, /environment:\s*editorial-safety-approval/);
assert.match(workflowRaw, /github\.actor.*github\.repository_owner/);
assert.match(workflowRaw, /lucasdmoyer/);
assert.match(workflowRaw, /editorial:safety:record/);
assert.match(workflowRaw, /npm run validate/);
assert.match(workflowRaw, /npm run build/);
assert.match(workflowRaw, /npm run smoke/);
assert.match(workflowRaw, /gh pr create/);
assert.doesNotMatch(workflowText, /OPENAI_API_KEY|codex-action/);
assert.doesNotMatch(workflowRaw, /firebase deploy|gh pr merge/);

console.log(JSON.stringify({
  editorialSafetyGateTests: 'passed',
  contractChecks: 12,
  cliRevisionChecks: 4,
  workflowChecks: 10,
  publicationAuthorized: false
}, null, 2));
