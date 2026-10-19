import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { loadFounderSafetyContext, requireFounderSafetyReceipt } from './lib/founder-safety-review-contract.mjs';
import { assertFounderSafetyWorkflowRun, founderSafetyAttestationArgs } from './verify-founder-safety-provenance.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const workflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'editorial-founder-safety-review.yml'), 'utf8');
assert.match(workflow, /test "\$ACTOR" = "\$OWNER"/);
assert.match(workflow, /environment: editorial-founder-safety/);
assert.match(workflow, /test -z "\$\(git status --short web\/research\/reviews\)"/);
assert.match(workflow, /Founder approval cannot authorize publication or deployment/);
assert.match(workflow, /actions\/attest-build-provenance@v3[\s\S]*subject-path: web\/research\/founder-safety-reviews/);
assert.match(workflow, /Trusted master is not generation-clean before founder approval/);
assert.doesNotMatch(workflow, /web\/public\/sitemap\.xml/);
assert.doesNotMatch(workflow, /firebase deploy|FirebaseExtended\/action-hosting-deploy|google-github-actions\/auth/);
const manualReleaseWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'firebase-production.yml'), 'utf8');
const automaticReleaseWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'firebase-auto-production.yml'), 'utf8');
assert.match(manualReleaseWorkflow, /actions: read\s+attestations: read[\s\S]*review:safety:verify-provenance/);
assert.match(automaticReleaseWorkflow, /actions: read\s+attestations: read[\s\S]*review:safety:verify-provenance/);
const runId = '20261019-founder-safety-ab12cd34';
const articleSlug = 'sample-safety-gift-guide';
const highRiskClaim = {
  id: 'claim-exact-label-boundary',
  text: 'Follow the complete current product label, keep the item away from children, and stop if the stated exposure boundary is crossed.',
  risk: 'high',
  sourceIds: ['src-current-official-label']
};

async function createFixture({ risk = 'high' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-founder-safety-'));
  await Promise.all([
    fs.mkdir(path.join(root, 'research', 'runs'), { recursive: true }),
    fs.mkdir(path.join(root, 'src', 'data', 'blog'), { recursive: true }),
    fs.mkdir(path.join(root, 'social', 'drafts'), { recursive: true }),
    fs.mkdir(path.join(root, 'config'), { recursive: true })
  ]);
  const run = {
    runId,
    ideaId: 'founder-idea-999',
    status: 'qa_failed',
    draftAuthor: 'research-desk-fixture',
    article: { slug: articleSlug, status: 'draft' },
    claims: [{ ...highRiskClaim, risk }],
    qa: { passed: false, reviewerRole: 'independent-editor', reviewerId: 'pending-independent-review', receiptPath: null, blockers: risk === 'high' ? ['Founder review is required for the exact reader-facing safety wording.'] : ['Fresh independent review is required.'], warnings: [] }
  };
  await fs.writeFile(path.join(root, 'research', 'runs', `${runId}.json`), `${JSON.stringify(run, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'src', 'data', 'blog', `${articleSlug}.md`), `---\nslug: ${articleSlug}\nstatus: draft\n---\n\n# Sample guide\n`);
  await fs.writeFile(path.join(root, 'social', 'drafts', `${articleSlug}-launch.json`), `${JSON.stringify({ schemaVersion: '1.0.0', researchRun: runId, articleSlug, posts: [] }, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'config', 'publication-policy.json'), `${JSON.stringify({ requiredApproverLogin: 'lucasdmoyer' }, null, 2)}\n`);
  return root;
}

function approvalArgs(context, overrides = {}) {
  const targetRunId = context.run.runId;
  const values = {
    'run-id': targetRunId,
    confirmation: `APPROVE-SAFETY-${targetRunId}`,
    'expected-run-sha256': context.sourceSha256.run,
    'expected-article-sha256': context.sourceSha256.article,
    'expected-social-sha256': context.sourceSha256.social,
    'approved-claim-ids': context.claims.map((claim) => claim.id).sort().join(','),
    ...overrides
  };
  return Object.entries(values).map(([key, value]) => `--${key}=${value ?? ''}`);
}

function workflowEnv(overrides = {}) {
  return {
    ...process.env,
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'lucasdmoyer/tipsforyourgifts',
    GITHUB_WORKFLOW_REF: 'lucasdmoyer/tipsforyourgifts/.github/workflows/editorial-founder-safety-review.yml@refs/heads/master',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_ACTOR: 'lucasdmoyer',
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: '1'.repeat(40),
    ...overrides
  };
}

const validWorkflowRun = {
  id: 123456789,
  run_attempt: 1,
  repository: { full_name: 'lucasdmoyer/tipsforyourgifts' },
  path: '.github/workflows/editorial-founder-safety-review.yml',
  event: 'workflow_dispatch',
  head_branch: 'master',
  head_sha: '1'.repeat(40),
  actor: { login: 'lucasdmoyer' },
  status: 'completed',
  conclusion: 'success'
};
const validWorkflowApproval = { path: `research/founder-safety-reviews/${runId}.founder.v1.json`, workflowRunId: '123456789', runAttempt: '1', sourceCommitSha: '1'.repeat(40) };
assert.equal(assertFounderSafetyWorkflowRun(validWorkflowRun, validWorkflowApproval), true);
assert.throws(() => assertFounderSafetyWorkflowRun({ ...validWorkflowRun, conclusion: 'failure' }, validWorkflowApproval), /did not complete successfully/);
assert.throws(() => assertFounderSafetyWorkflowRun({ ...validWorkflowRun, run_attempt: 2 }, validWorkflowApproval), /workflow run attempt mismatch/);
assert.deepEqual(founderSafetyAttestationArgs(validWorkflowApproval), [
  'attestation',
  'verify',
  path.resolve(process.cwd(), validWorkflowApproval.path),
  '--repo',
  'lucasdmoyer/tipsforyourgifts',
  '--signer-workflow',
  'lucasdmoyer/tipsforyourgifts/.github/workflows/editorial-founder-safety-review.yml',
  '--source-ref',
  'refs/heads/master',
  '--source-digest',
  '1'.repeat(40)
]);

const missingApprovalRoot = await createFixture();
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'create-review-receipt.mjs'), `--run-id=${runId}`, '--reviewer-id=independent-editor-fixture', '--verdict=passed'], { cwd: missingApprovalRoot }), /founder safety approval is required/);

const root = await createFixture();
const context = await loadFounderSafetyContext(root, runId);
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(context, { confirmation: 'APPROVE-SAFETY-something-else' })], { cwd: root }), /Action-time confirmation/);
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(context)], { cwd: root, env: workflowEnv({ GITHUB_ACTIONS: 'false' }) }), /exact protected GitHub workflow/);
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(context, { 'approved-claim-ids': 'claim-something-else' })], { cwd: root, env: workflowEnv() }), /complete current high-risk claim set/);
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(context, { 'expected-article-sha256': '0'.repeat(64) })], { cwd: root, env: workflowEnv() }), /article source digest changed/);
await execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(context)], { cwd: root, env: workflowEnv() });
const validatedApproval = await requireFounderSafetyReceipt(root, runId);
assert.equal(validatedApproval.required, true);
assert.equal(validatedApproval.receipt.publicationAuthorized, false);
assert.equal(validatedApproval.receipt.productionDeploymentAuthorized, false);
assert.equal(validatedApproval.receipt.provenance.workflowRef, workflowEnv().GITHUB_WORKFLOW_REF);
assert.deepEqual(validatedApproval.receipt.claimApprovals.map((claim) => claim.claimId), [highRiskClaim.id]);
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(context)], { cwd: root, env: workflowEnv() }), /already carries an immutable|immutable/);

await execFileAsync(process.execPath, [path.join(scriptRoot, 'create-review-receipt.mjs'), `--run-id=${runId}`, '--reviewer-id=independent-editor-fixture', '--verdict=passed', '--workflow-run-id=independent-review-fixture-1'], { cwd: root });
await execFileAsync(process.execPath, [path.join(scriptRoot, 'promote-reviewed-run.mjs'), runId], { cwd: root });
const promotedRun = JSON.parse(await fs.readFile(path.join(root, 'research', 'runs', `${runId}.json`), 'utf8'));
const promotedArticle = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${articleSlug}.md`), 'utf8');
assert.equal(promotedRun.status, 'validated');
assert.match(promotedArticle, /^status: publication_ready$/m);
const postPromotionApproval = await requireFounderSafetyReceipt(root, runId);
assert.equal(postPromotionApproval.receipt.receiptId, `${runId}-founder-safety`);
const approvalPath = path.join(root, 'research', 'founder-safety-reviews', `${runId}.founder.v1.json`);
const approvalRaw = await fs.readFile(approvalPath, 'utf8');
await fs.rm(approvalPath);
await assert.rejects(() => requireFounderSafetyReceipt(root, runId), /founder safety approval is required/);
await fs.writeFile(approvalPath, approvalRaw);
promotedRun.claims[0].text += ' Unauthorized post-promotion drift.';
await fs.writeFile(path.join(root, 'research', 'runs', `${runId}.json`), `${JSON.stringify(promotedRun, null, 2)}\n`);
await assert.rejects(() => requireFounderSafetyReceipt(root, runId), /reviewable digest changed|exact complete high-risk claim set/);

const staleRoot = await createFixture();
const staleContext = await loadFounderSafetyContext(staleRoot, runId);
await execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(staleContext)], { cwd: staleRoot, env: workflowEnv({ GITHUB_RUN_ID: '123456790' }) });
const staleRunPath = path.join(staleRoot, 'research', 'runs', `${runId}.json`);
const staleRun = JSON.parse(await fs.readFile(staleRunPath, 'utf8'));
staleRun.claims[0].text += ' Material wording drift.';
await fs.writeFile(staleRunPath, `${JSON.stringify(staleRun, null, 2)}\n`);
await assert.rejects(() => requireFounderSafetyReceipt(staleRoot, runId), /changed after founder review|exact complete high-risk claim set/);

const lowRiskRoot = await createFixture({ risk: 'low' });
await execFileAsync(process.execPath, [path.join(scriptRoot, 'create-review-receipt.mjs'), `--run-id=${runId}`, '--reviewer-id=independent-editor-fixture', '--verdict=passed'], { cwd: lowRiskRoot });

const unclassifiedSafetyRoot = await createFixture({ risk: 'low' });
const unclassifiedRunPath = path.join(unclassifiedSafetyRoot, 'research', 'runs', `${runId}.json`);
const unclassifiedRun = JSON.parse(await fs.readFile(unclassifiedRunPath, 'utf8'));
unclassifiedRun.qa.blockers = ['Safety wording needs exact high-risk claim classification before founder review.'];
await fs.writeFile(unclassifiedRunPath, `${JSON.stringify(unclassifiedRun, null, 2)}\n`);
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'create-review-receipt.mjs'), `--run-id=${runId}`, '--reviewer-id=independent-editor-fixture', '--verdict=passed'], { cwd: unclassifiedSafetyRoot }), /classified as at least one high-risk claim/);

const fullGateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-founder-safety-full-gate-'));
const sourceWebRoot = path.resolve(scriptRoot, '..');
await Promise.all([
  fs.mkdir(path.join(fullGateRoot, 'social'), { recursive: true }),
  fs.mkdir(path.join(fullGateRoot, 'src', 'data'), { recursive: true })
]);
await Promise.all([
  fs.cp(path.join(sourceWebRoot, 'research'), path.join(fullGateRoot, 'research'), { recursive: true }),
  fs.cp(path.join(sourceWebRoot, 'social', 'drafts'), path.join(fullGateRoot, 'social', 'drafts'), { recursive: true }),
  fs.cp(path.join(sourceWebRoot, 'src', 'data', 'blog'), path.join(fullGateRoot, 'src', 'data', 'blog'), { recursive: true }),
  fs.cp(path.join(sourceWebRoot, 'config'), path.join(fullGateRoot, 'config'), { recursive: true })
]);
await fs.copyFile(path.join(sourceWebRoot, 'src', 'data', 'strategy.json'), path.join(fullGateRoot, 'src', 'data', 'strategy.json'));
const fullGateRunId = '20260823-fiber-art-pause-269f700c';
const fullGateContext = await loadFounderSafetyContext(fullGateRoot, fullGateRunId);
await execFileAsync(process.execPath, [path.join(scriptRoot, 'record-founder-safety-review.mjs'), ...approvalArgs(fullGateContext)], { cwd: fullGateRoot, env: workflowEnv({ GITHUB_RUN_ID: '123456791' }) });
await execFileAsync(process.execPath, [path.join(scriptRoot, 'create-review-receipt.mjs'), `--run-id=${fullGateRunId}`, '--reviewer-id=independent-editor-full-gate', '--verdict=passed'], { cwd: fullGateRoot });
await execFileAsync(process.execPath, [path.join(scriptRoot, 'promote-reviewed-run.mjs'), fullGateRunId], { cwd: fullGateRoot });
await execFileAsync(process.execPath, [path.join(scriptRoot, 'validate-research.mjs')], { cwd: fullGateRoot });
await fs.rm(path.join(fullGateRoot, 'research', 'founder-safety-reviews', `${fullGateRunId}.founder.v1.json`));
await assert.rejects(() => execFileAsync(process.execPath, [path.join(scriptRoot, 'validate-research.mjs')], { cwd: fullGateRoot }), /founder safety approval is missing or invalid/);

console.log(JSON.stringify({ founderSafetyReviewTests: 'passed', negativeChecks: 12, workflowSafetyChecks: 10, immutableReceipt: true, exactClaimBinding: true, protectedWorkflowProvenanceRequired: true, oidcReceiptAttestationRequired: true, releaseWorkflowProvenanceVerificationRequired: true, missingReceiptAfterPromotionRejected: true, fullResearchGateDeletionRejected: true, unclassifiedSafetyBlockerRejected: true, independentReviewStillRequired: true, postPromotionDriftRejected: true, publicationAuthorized: false, productionDeploymentAuthorized: false }, null, 2));
