import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { parseReleaseApproval } from './lib/release-approval-contract.mjs';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-release-approval-recording-'));
const headSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const prNumber = 42;
const commentId = 123456;
const approvalBody = `## Founder release approval — exact candidate only

Lucas approved review of this exact release and required the hosted preview to be reviewed first. That review is now complete.

### Immutable identity

- PR head: \`${headSha}\`
- GitHub artifact: \`998877\` from workflow run \`112233\`
- Artifact SHA-256: \`${'c'.repeat(64)}\`
- Firebase preview: https://tipsforyourgifts--pr-42-aaaaaaa.web.app/

### Reviewed evidence

- hosted smoke: 20 routes / 11 public articles passed
- Bookshop pilot: exact Sapiens URL present, \`rel=sponsored\`, paid-link labeling present, disclosure before recommendation
- security headers present; preview sends \`X-Robots-Tag: noindex\`
- Lighthouse 13.6.0 homepage: 100 Performance / 100 Accessibility / 100 Best Practices; FCP 1.0s, LCP 1.0s, TBT 10ms, CLS 0
- Lighthouse 13.6.0 Studio: 100 / 100 / 100; FCP 1.0s, LCP 1.1s, TBT 50ms, CLS 0

### Approval boundary

Approved for merge **only while the PR head remains exactly \`${headSha}\`**. This approval does not transfer to a changed head, merge commit, replay, or later artifact. It does not authorize Firebase production deployment, IAM changes, credentials, affiliate expansion, social publishing, email, or spend. After merge, the exact resulting master SHA still requires its own preview/readback and action-time production approval.`;
const pullRequest = {
  number: prNumber,
  state: 'open',
  html_url: `https://github.com/lucasdmoyer/tipsforyourgifts/pull/${prNumber}`,
  head: { sha: headSha, repo: { full_name: 'lucasdmoyer/tipsforyourgifts' } },
  base: { ref: 'master', sha: baseSha }
};
const comment = {
  id: commentId,
  html_url: `${pullRequest.html_url}#issuecomment-${commentId}`,
  user: { login: 'lucasdmoyer' },
  author_association: 'OWNER',
  created_at: '2026-11-23T21:43:27Z',
  updated_at: '2026-11-23T21:43:27Z',
  body: approvalBody
};
const manifest = JSON.parse(await fs.readFile(path.join(root, 'public', 'publication-manifest.json'), 'utf8'));
const prPath = path.join(fixtureRoot, 'pr.json');
const commentPath = path.join(fixtureRoot, 'comment.json');
const manifestPath = path.join(fixtureRoot, 'manifest.json');
const outputPath = path.join(fixtureRoot, 'approval.json');
await fs.writeFile(prPath, JSON.stringify(pullRequest));
await fs.writeFile(commentPath, JSON.stringify(comment));
await fs.writeFile(manifestPath, JSON.stringify(manifest));

const command = [
  path.join(root, 'scripts', 'create-release-approval-from-github.mjs'),
  `--pull-request-json=${prPath}`,
  `--approval-comment-json=${commentPath}`,
  `--publication-manifest=${manifestPath}`,
  `--expected-head-sha=${headSha}`,
  '--observed-at=2026-11-23T22:00:00.000Z',
  `--confirmation=RECORD-PR-${prNumber}-${headSha}`,
  `--output=${outputPath}`
];
await execFileAsync(process.execPath, command, { cwd: root });
const record = parseReleaseApproval(JSON.parse(await fs.readFile(outputPath, 'utf8')));
assert.equal(record.pullRequest.headSha, headSha);
assert.equal(record.approval.approvedBy, 'lucasdmoyer');
assert.equal(record.previewReview.lighthouse.lcpSeconds, 1.1);
assert.deepEqual(record.authority.allowed, ['merge_exact_pull_request_head']);
assert.ok(record.authority.excluded.includes('firebase_production_deployment'));

async function expectCommandFailure(label, mutate, pattern) {
  const changedPr = structuredClone(pullRequest);
  const changedComment = structuredClone(comment);
  mutate(changedPr, changedComment);
  await fs.writeFile(prPath, JSON.stringify(changedPr));
  await fs.writeFile(commentPath, JSON.stringify(changedComment));
  await fs.rm(outputPath, { force: true });
  await assert.rejects(() => execFileAsync(process.execPath, command, { cwd: root }), pattern, label);
}

await expectCommandFailure('wrong actor rejected', (_pr, value) => { value.user.login = 'someone-else'; }, /repository owner/);
await expectCommandFailure('edited comment rejected', (_pr, value) => { value.updated_at = '2026-11-23T21:44:00Z'; }, /edited approval comments/);
await expectCommandFailure('changed head rejected', (value) => { value.head.sha = 'd'.repeat(40); }, /head changed/);
await expectCommandFailure('fork pull request rejected', (value) => { value.head.repo.full_name = 'fork/tipsforyourgifts'; }, /same-repository/);
await expectCommandFailure('non-master base rejected', (value) => { value.base.ref = 'develop'; }, /master base/);
await expectCommandFailure('authority expansion rejected', (_pr, value) => { value.body = value.body.replace('email, or spend.', 'email, or spend unless later approved.'); }, /authority exclusions/);

const workflow = await fs.readFile(path.join(root, '..', '.github', 'workflows', 'release-approval-record.yml'), 'utf8');
assert.match(workflow, /Require repository-owner action and exact confirmation/);
assert.match(workflow, /ref: master/);
assert.match(workflow, /Fetch immutable GitHub evidence without checking out pull request code/);
assert.match(workflow, /actions\/upload-artifact@v7/);
assert.match(workflow, /actions\/download-artifact@v8/);
assert.match(workflow, /contents: read[\s\S]*issues: read[\s\S]*pull-requests: read/);
assert.match(workflow, /propose:[\s\S]*contents: write[\s\S]*pull-requests: write/);
assert.doesNotMatch(workflow, /firebase (?:deploy|hosting:channel:deploy)|google-github-actions\/auth|OPENAI_API_KEY/);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log(JSON.stringify({
  releaseApprovalRecordingTests: 'passed',
  commandNegativeChecks: 6,
  workflowSafetyChecks: 8,
  pullRequestCodeExecuted: false,
  productionAuthorized: false
}, null, 2));
