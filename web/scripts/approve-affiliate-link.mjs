import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { affiliateLinkApprovalSchema, affiliateLinkCandidateSchema, affiliateLinkReviewSchema, loadAffiliateLinkState, sha256 } from './lib/affiliate-link-contract.mjs';

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const candidateId = args['candidate-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidateId)) throw new Error('candidate-id must be a lowercase slug');
if (!/^[a-f0-9]{64}$/.test(args['expected-candidate-sha256'] ?? '') || !/^[a-f0-9]{64}$/.test(args['expected-review-sha256'] ?? '')) throw new Error('exact candidate and review SHA-256 digests are required');
const candidatePath = path.join(root, 'affiliate', 'candidates', `${candidateId}.json`);
const reviewPath = path.join(root, 'affiliate', 'reviews', `${candidateId}-review.json`);
const candidateRaw = await fs.readFile(candidatePath);
const reviewRaw = await fs.readFile(reviewPath);
if (sha256(candidateRaw) !== args['expected-candidate-sha256']) throw new Error('candidate SHA-256 does not match');
if (sha256(reviewRaw) !== args['expected-review-sha256']) throw new Error('review SHA-256 does not match');
affiliateLinkCandidateSchema.parse(JSON.parse(candidateRaw.toString('utf8')));
const review = affiliateLinkReviewSchema.parse(JSON.parse(reviewRaw.toString('utf8')));
if (review.verdict !== 'passed' || review.blockers.length > 0) throw new Error('only a clean independent review can be approved');
const confirmation = args.confirmation ?? '';
if (confirmation !== `APPROVE-${candidateId}`) throw new Error(`Action-time confirmation must equal APPROVE-${candidateId}`);
const registry = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
if (args['founder-login'] !== registry.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const approval = affiliateLinkApprovalSchema.parse({
  schemaVersion: '1.0.0',
  approvalId: `${candidateId}-approval`,
  candidateId,
  candidatePath: `affiliate/candidates/${candidateId}.json`,
  candidateSha256: sha256(candidateRaw),
  reviewPath: `affiliate/reviews/${candidateId}-review.json`,
  reviewSha256: sha256(reviewRaw),
  founderLogin: args['founder-login'],
  approvedAt: new Date().toISOString(),
  confirmation,
  status: 'approved',
  assertions: {
    exactPaidDestinationApproved: true,
    affiliateDisclosureRequired: true,
    editorialRankingUnchanged: true,
    firebasePreviewRequiredBeforeRelease: true,
    productionDeploymentAuthorized: false
  }
});
const outputPath = path.join(root, 'affiliate', 'approvals', `${approval.approvalId}.json`);
try { await fs.access(outputPath); throw new Error(`${approval.approvalId} already exists`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(approval, null, 2)}\n`);
await loadAffiliateLinkState(root);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `candidate_id=${candidateId}\napproval_path=${path.relative(root, outputPath)}\n`);
console.log(JSON.stringify({ approved: true, candidateId, overlayEligible: true, previewRequired: true, deployed: false }, null, 2));
