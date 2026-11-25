import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { sha256, visualProductionDirectory, visualProductionManifestSchema, visualReviewFindingsSchema } from './lib/visual-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const requestId = args['request-id'];
const modelOutcome = args['model-outcome'];
const expectedManifestSha256 = args['expected-manifest-sha256'];
if (!requestId || !modelOutcome || !/^[a-f0-9]{64}$/.test(expectedManifestSha256 ?? '')) throw new Error('Usage: node scripts/classify-visual-review-output.mjs --request-id=<id> --model-outcome=<success|failure> --expected-manifest-sha256=<sha256>');

const root = process.cwd();
const result = { reviewOutcome: 'failed', failureCode: modelOutcome === 'success' ? 'review_findings_invalid' : 'review_step_failed', verdict: null, findingsSha256: null, issueCodes: [] };
const finish = async () => {
  result.issueCodes = [...new Set(result.issueCodes)].sort();
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `review_outcome=${result.reviewOutcome}\nreview_failure_code=${result.failureCode ?? ''}\nverdict=${result.verdict ?? ''}\nfindings_sha256=${result.findingsSha256 ?? ''}\n`);
  console.log(JSON.stringify(result, null, 2));
};
if (modelOutcome !== 'success') {
  result.issueCodes.push('review_step_failed');
  await finish();
  process.exit(0);
}

try {
  const directory = visualProductionDirectory(requestId);
  const manifestRaw = await fs.readFile(path.join(root, directory, 'manifest.json'));
  const findingsRaw = await fs.readFile(path.join(root, directory, 'visual-review-findings.json'));
  const manifest = visualProductionManifestSchema.parse(JSON.parse(manifestRaw));
  const findings = visualReviewFindingsSchema.parse(JSON.parse(findingsRaw));
  if (manifest.requestId !== requestId || findings.requestId !== requestId) result.issueCodes.push('review_request_mismatch');
  if (sha256(manifestRaw) !== expectedManifestSha256 || findings.manifestSha256 !== expectedManifestSha256) result.issueCodes.push('review_manifest_binding_invalid');
  if (new Set(findings.assets.map((asset) => asset.assetId)).size !== manifest.assets.length || findings.assets.some((asset) => !manifest.assets.some((entry) => entry.assetId === asset.assetId))) result.issueCodes.push('review_asset_coverage_invalid');
  if (result.issueCodes.length === 0) {
    result.reviewOutcome = 'ready';
    result.failureCode = findings.verdict === 'failed' ? 'review_verdict_failed' : null;
    result.verdict = findings.verdict;
    result.findingsSha256 = sha256(findingsRaw);
  }
} catch {
  result.issueCodes.push('review_findings_unreadable');
}
await finish();
