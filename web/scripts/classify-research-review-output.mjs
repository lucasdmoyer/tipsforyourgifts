import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const runId = args['run-id'];
const articleSlug = args['article-slug'];
const modelOutcome = args['model-outcome'];
const expectedSourcePatchSha = args['expected-source-patch-sha'];
const expectedDraftPatchSha = args['expected-draft-patch-sha'];
const outputPath = args.output;
if (!runId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleSlug ?? '') || !modelOutcome || !/^[a-f0-9]{64}$/.test(expectedSourcePatchSha ?? '') || !/^[a-f0-9]{64}$/.test(expectedDraftPatchSha ?? '') || !outputPath) {
  throw new Error('Usage: node scripts/classify-research-review-output.mjs --run-id=<id> --article-slug=<slug> --model-outcome=<success|failure> --expected-source-patch-sha=<sha256> --expected-draft-patch-sha=<sha256> --output=<path>');
}

const webRoot = process.cwd();
const repositoryRoot = path.resolve(webRoot, '..');
const resultPath = path.join(repositoryRoot, 'editorial-review-result.json');
const result = {
  reviewOutcome: 'failed',
  failureCode: modelOutcome === 'success' ? 'review_result_invalid' : 'review_model_step_failed',
  verdict: null,
  issueCodes: []
};
const finish = async () => {
  result.issueCodes = [...new Set(result.issueCodes)].sort();
  await fs.writeFile(path.resolve(webRoot, outputPath), `${JSON.stringify(result, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `review_outcome=${result.reviewOutcome}\nreview_failure_code=${result.failureCode ?? ''}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
};
if (modelOutcome !== 'success') {
  result.issueCodes.push('review_model_step_failed');
  await finish();
  process.exit(0);
}

const sourcePaths = [
  `web/research/runs/${runId}.json`,
  `web/src/data/blog/${articleSlug}.md`,
  `web/social/drafts/${articleSlug}-launch.json`,
  `web/visuals/requests/${runId}-visuals.json`
];
const [{ stdout: draftPatch }, { stdout: sourcePatch }, { stdout: untracked }] = await Promise.all([
  execFileAsync('git', ['diff', '--binary', 'HEAD'], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 }),
  execFileAsync('git', ['diff', '--binary', 'HEAD', '--', ...sourcePaths], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 }),
  execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repositoryRoot })
]);
const { createHash } = await import('node:crypto');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
if (sha256(draftPatch) !== expectedDraftPatchSha) result.issueCodes.push('review_changed_draft_patch');
if (sha256(sourcePatch) !== expectedSourcePatchSha) result.issueCodes.push('review_changed_source_bundle');
const untrackedPaths = untracked.split(/\r?\n/).filter(Boolean).sort();
if (JSON.stringify(untrackedPaths) !== JSON.stringify(['editorial-review-result.json'])) result.issueCodes.push('unexpected_untracked_output');

try {
  const findings = JSON.parse(await fs.readFile(resultPath, 'utf8'));
  const keys = Object.keys(findings).sort();
  const expectedKeys = ['blockers', 'runId', 'schemaVersion', 'verdict', 'warnings'];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) result.issueCodes.push('review_result_shape_invalid');
  if (findings.schemaVersion !== '1.0.0' || findings.runId !== runId || !['passed', 'failed'].includes(findings.verdict)) result.issueCodes.push('review_result_identity_invalid');
  if (!Array.isArray(findings.blockers) || !Array.isArray(findings.warnings) || [...(findings.blockers ?? []), ...(findings.warnings ?? [])].some((entry) => typeof entry !== 'string' || entry.trim().length < 12)) result.issueCodes.push('review_findings_invalid');
  if (findings.verdict === 'passed' && findings.blockers.length !== 0) result.issueCodes.push('passed_review_has_blockers');
  if (findings.verdict === 'failed' && findings.blockers.length === 0) result.issueCodes.push('failed_review_missing_blockers');
  if (result.issueCodes.length === 0) {
    result.reviewOutcome = 'ready';
    result.failureCode = null;
    result.verdict = findings.verdict;
  }
} catch {
  result.issueCodes.push('review_result_unreadable');
}

await finish();
