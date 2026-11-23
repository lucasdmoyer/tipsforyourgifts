import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), 'scripts/classify-research-review-output.mjs');
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-review-classifier-'));
const webRoot = path.join(fixtureRoot, 'web');
const runId = '20261123-independent-review-a1b2c3d4';
const slug = 'independent-review-fixture';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const writeJson = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

async function patchSha(paths = []) {
  const { stdout } = await execFileAsync('git', ['diff', '--binary', 'HEAD', ...paths], { cwd: fixtureRoot });
  return sha256(stdout);
}

async function classify(modelOutcome, outputName, expectedDraftPatchSha, expectedSourcePatchSha) {
  const outputPath = path.join(fixtureRoot, outputName);
  await execFileAsync(process.execPath, [
    scriptPath,
    `--run-id=${runId}`,
    `--article-slug=${slug}`,
    `--model-outcome=${modelOutcome}`,
    `--expected-source-patch-sha=${expectedSourcePatchSha}`,
    `--expected-draft-patch-sha=${expectedDraftPatchSha}`,
    `--output=${outputPath}`
  ], { cwd: webRoot });
  return JSON.parse(await fs.readFile(outputPath, 'utf8'));
}

try {
  await fs.mkdir(webRoot, { recursive: true });
  await execFileAsync('git', ['init'], { cwd: fixtureRoot });
  await execFileAsync('git', ['config', 'user.name', 'fixture'], { cwd: fixtureRoot });
  await execFileAsync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: fixtureRoot });
  await writeJson(path.join(webRoot, 'base.json'), { base: true });
  await execFileAsync('git', ['add', '.'], { cwd: fixtureRoot });
  await execFileAsync('git', ['commit', '-m', 'fixture base'], { cwd: fixtureRoot });

  await writeJson(path.join(webRoot, 'research/runs', `${runId}.json`), { runId, status: 'drafted', article: { slug, status: 'draft' }, qa: { passed: false } });
  await fs.mkdir(path.join(webRoot, 'src/data/blog'), { recursive: true });
  await fs.writeFile(path.join(webRoot, 'src/data/blog', `${slug}.md`), '---\nstatus: draft\n---\nCredential-free fixture.\n');
  await writeJson(path.join(webRoot, 'social/drafts', `${slug}-launch.json`), { packId: `${slug}-launch`, researchRun: runId });
  await execFileAsync('git', ['add', '-N', '.'], { cwd: fixtureRoot });

  const sourceArgs = ['--', `web/research/runs/${runId}.json`, `web/src/data/blog/${slug}.md`, `web/social/drafts/${slug}-launch.json`, `web/visuals/requests/${runId}-visuals.json`];
  const expectedDraftPatchSha = await patchSha();
  const expectedSourcePatchSha = await patchSha(sourceArgs);

  await writeJson(path.join(fixtureRoot, 'editorial-review-result.json'), { schemaVersion: '1.0.0', runId, verdict: 'passed', blockers: [], warnings: ['Keep merchant availability claims bounded to the cited evidence.'] });
  const valid = await classify('success', 'valid-route.json', expectedDraftPatchSha, expectedSourcePatchSha);
  if (valid.reviewOutcome !== 'ready' || valid.verdict !== 'passed') throw new Error(`valid reviewer result did not route to receipt creation: ${JSON.stringify(valid)}`);

  const modelFailure = await classify('failure', 'model-failure-route.json', expectedDraftPatchSha, expectedSourcePatchSha);
  if (modelFailure.reviewOutcome !== 'failed' || modelFailure.failureCode !== 'review_model_step_failed') throw new Error('review model failure did not route to the clean review-failure lane');

  await writeJson(path.join(fixtureRoot, 'editorial-review-result.json'), { schemaVersion: '1.0.0', runId, verdict: 'failed', blockers: [], warnings: [] });
  const malformed = await classify('success', 'malformed-route.json', expectedDraftPatchSha, expectedSourcePatchSha);
  if (malformed.reviewOutcome !== 'failed' || malformed.failureCode !== 'review_result_invalid' || !malformed.issueCodes.includes('failed_review_missing_blockers')) throw new Error('malformed reviewer result did not fail closed');

  await writeJson(path.join(fixtureRoot, 'editorial-review-result.json'), { schemaVersion: '1.0.0', runId, verdict: 'passed', blockers: [], warnings: [] });
  await fs.writeFile(path.join(webRoot, 'src/data/blog', `${slug}.md`), '---\nstatus: draft\n---\nReviewer changed the source bundle.\n');
  const mutation = await classify('success', 'mutation-route.json', expectedDraftPatchSha, expectedSourcePatchSha);
  if (mutation.reviewOutcome !== 'failed' || !mutation.issueCodes.includes('review_changed_source_bundle')) throw new Error('reviewer source mutation did not fail closed');

  console.log(JSON.stringify({ researchReviewOutputGateTests: 'passed', validReviewRoutesTo: 'receipt_creation', modelFailureRoutesTo: 'review_failed', malformedOutputRoutesTo: 'review_failed', reviewerMutationRoutesTo: 'review_failed', partialReviewPromoted: false, reviewReceiptFabricated: false }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
