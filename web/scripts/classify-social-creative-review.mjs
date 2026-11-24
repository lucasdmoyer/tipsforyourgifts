import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { sha256, socialCreativeProductionDirectory, socialCreativeProductionManifestSchema, socialCreativeReviewFindingsSchema } from './lib/social-creative-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => { const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
const candidateId = args['candidate-id'];
const modelOutcome = args['model-outcome'];
const expectedManifestSha256 = args['expected-manifest-sha256'];
if (!candidateId || !modelOutcome || !/^[a-f0-9]{64}$/.test(expectedManifestSha256 ?? '')) throw new Error('Usage: node scripts/classify-social-creative-review.mjs --candidate-id=<id> --model-outcome=<success|failure> --expected-manifest-sha256=<sha256>');
const result = { reviewOutcome: 'failed', failureCode: modelOutcome === 'success' ? 'review-findings-invalid' : 'review-step-failed', verdict: null, findingsSha256: null, issueCodes: [] };
if (modelOutcome === 'success') {
  try {
    const directory = socialCreativeProductionDirectory(candidateId);
    const manifestRaw = await fs.readFile(path.join(process.cwd(), directory, 'manifest.json'));
    const findingsRaw = await fs.readFile(path.join(process.cwd(), directory, 'review-findings.json'));
    const manifest = socialCreativeProductionManifestSchema.parse(JSON.parse(manifestRaw));
    const findings = socialCreativeReviewFindingsSchema.parse(JSON.parse(findingsRaw));
    if (manifest.candidateId !== candidateId || findings.candidateId !== candidateId) result.issueCodes.push('candidate-id-mismatch');
    if (sha256(manifestRaw) !== expectedManifestSha256 || findings.manifestSha256 !== expectedManifestSha256) result.issueCodes.push('manifest-binding-invalid');
    if (result.issueCodes.length === 0) { result.reviewOutcome = 'ready'; result.failureCode = null; result.verdict = findings.verdict; result.findingsSha256 = sha256(findingsRaw); }
  } catch { result.issueCodes.push('review-findings-unreadable'); }
} else result.issueCodes.push('review-step-failed');
result.issueCodes = [...new Set(result.issueCodes)].sort();
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `review_outcome=${result.reviewOutcome}\nreview_failure_code=${result.failureCode ?? ''}\nverdict=${result.verdict ?? ''}\nfindings_sha256=${result.findingsSha256 ?? ''}\n`);
console.log(JSON.stringify(result, null, 2));
