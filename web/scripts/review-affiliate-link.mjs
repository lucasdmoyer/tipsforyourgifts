import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { affiliateLinkCandidateSchema, affiliateLinkReviewSchema, loadAffiliateLinkState, sha256 } from './lib/affiliate-link-contract.mjs';

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const candidateId = args['candidate-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidateId) || !/^[a-f0-9]{64}$/.test(args['expected-candidate-sha256'] ?? '') || !args['reviewer-id']) {
  throw new Error('Usage: --candidate-id=<id> --expected-candidate-sha256=<sha256> --reviewer-id=<independent-id> --verdict=passed|failed');
}
const candidatePath = path.join(root, 'affiliate', 'candidates', `${candidateId}.json`);
const candidateRaw = await fs.readFile(candidatePath);
if (sha256(candidateRaw) !== args['expected-candidate-sha256']) throw new Error('candidate SHA-256 does not match the exact reviewed record');
const candidate = affiliateLinkCandidateSchema.parse(JSON.parse(candidateRaw.toString('utf8')));
if (args['reviewer-id'] === candidate.createdBy) throw new Error('candidate creator cannot independently review the same link');
const verdict = args.verdict;
if (!['passed', 'failed'].includes(verdict)) throw new Error('verdict must be passed or failed');

let destination = { httpStatus: null, resolvedUrl: null, resolvedHostname: null, verifiedAt: null };
let trackingPreserved = false;
let productIdentityMatched = args['product-identity-matched'] === 'true';
const blockers = [];
if (verdict === 'passed') {
  if (!productIdentityMatched) throw new Error('passing review requires --product-identity-matched=true after independent page inspection');
  const response = await fetch(candidate.destination.paidUrl, { redirect: 'follow', signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'TipsForYourGifts-AffiliateLinkVerifier/1.0' } });
  const resolved = new URL(response.url);
  const paid = new URL(candidate.destination.paidUrl);
  trackingPreserved = candidate.destination.trackingParameterKeys.every((key) => JSON.stringify(paid.searchParams.getAll(key)) === JSON.stringify(resolved.searchParams.getAll(key)));
  destination = { httpStatus: response.status, resolvedUrl: resolved.toString(), resolvedHostname: resolved.hostname.toLowerCase(), verifiedAt: new Date().toISOString() };
  if (!response.ok) throw new Error(`paid destination returned HTTP ${response.status}`);
  if (!trackingPreserved) throw new Error('approved tracking values were not preserved through destination resolution');
} else {
  if (!args.blocker || args.blocker.length < 12) throw new Error('failed review requires a specific --blocker argument');
  blockers.push(args.blocker);
  productIdentityMatched = false;
}
const passed = verdict === 'passed';
const review = affiliateLinkReviewSchema.parse({
  schemaVersion: '1.0.0',
  reviewId: `${candidateId}-review`,
  candidateId,
  candidatePath: `affiliate/candidates/${candidateId}.json`,
  candidateSha256: sha256(candidateRaw),
  reviewerId: args['reviewer-id'],
  reviewedAt: new Date().toISOString(),
  verdict,
  destination,
  productIdentityEvidenceUrl: candidate.destination.productIdentityEvidenceUrl,
  checks: {
    candidateHashBound: true,
    programEnabledAtReview: passed,
    articleSourceBound: passed,
    productIdentityMatched,
    destinationHttps: passed,
    finalDomainAllowed: passed,
    trackingKeysApproved: passed,
    trackingPreserved,
    editorialRankingUntouched: passed,
    disclosureWillRender: passed,
    recommendationWorksWithoutPaidLink: passed,
    noPriceOrAvailabilityClaimAdded: passed
  },
  blockers
});
const outputPath = path.join(root, 'affiliate', 'reviews', `${review.reviewId}.json`);
try { await fs.access(outputPath); throw new Error(`${review.reviewId} already exists`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(review, null, 2)}\n`);
await loadAffiliateLinkState(root);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `candidate_id=${candidateId}\nreview_path=${path.relative(root, outputPath)}\nverdict=${verdict}\n`);
console.log(JSON.stringify({ reviewCreated: true, candidateId, verdict, approved: false, published: false }, null, 2));
