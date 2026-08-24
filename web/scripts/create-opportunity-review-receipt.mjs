import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { canonicalIdeaSha256 } from './lib/research-mission-contract.mjs';
import { opportunityReportSchema, opportunityReviewReceiptSchema, opportunityScoutMissionSchema, sha256 } from './lib/opportunity-scout-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const scoutId = args['scout-id'];
const reviewerId = args['reviewer-id'];
const verdict = args.verdict;
const workflowRunId = args['workflow-run-id'] ?? process.env.GITHUB_RUN_ID;
if (!scoutId || !reviewerId || !workflowRunId || !['passed', 'failed'].includes(verdict)) {
  throw new Error('Usage: node scripts/create-opportunity-review-receipt.mjs --scout-id=<id> --reviewer-id=<id> --verdict=passed|failed --workflow-run-id=<id>');
}

const root = process.cwd();
const missionPath = path.join(root, 'research/opportunity-missions', `${scoutId}.json`);
const reportPath = path.join(root, 'research/opportunities', `${scoutId}.json`);
const [missionRaw, reportRaw, strategy] = await Promise.all([
  fs.readFile(missionPath),
  fs.readFile(reportPath),
  fs.readFile(path.join(root, 'src/data/strategy.json'), 'utf8').then(JSON.parse)
]);
const mission = opportunityScoutMissionSchema.parse(JSON.parse(missionRaw));
const report = opportunityReportSchema.parse(JSON.parse(reportRaw));
if (mission.status !== 'started' || report.status !== 'drafted' || report.qa !== null) throw new Error('Opportunity report is not awaiting independent review');
if (report.draftAuthor === reviewerId) throw new Error('The independent reviewer cannot be the scout author');
const proposal = strategy.ideas.find((idea) => idea.id === report.selectedProposal.proposalId);
if (!proposal || proposal.founderDisposition !== 'proposed') throw new Error('The selected proposal is missing or no longer proposed');
const reviewedAt = args['reviewed-at'] ?? new Date().toISOString();
const receipt = opportunityReviewReceiptSchema.parse({
  schemaVersion: '1.0.0',
  receiptId: `${scoutId}-qa`,
  scoutId,
  reviewedAt,
  reviewerRole: 'independent-opportunity-editor',
  reviewerId,
  workflowRunId,
  verdict,
  startedMissionSha256: sha256(missionRaw),
  draftReportSha256: sha256(reportRaw),
  proposalSha256: canonicalIdeaSha256(proposal),
  blockers: verdict === 'failed' ? ['Independent opportunity review did not approve this proposal.'] : [],
  warnings: []
});
const outputPath = path.join(root, 'research/opportunity-reviews', `${scoutId}.qa.v1.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ receiptPath: `research/opportunity-reviews/${scoutId}.qa.v1.json`, verdict, scoutId }, null, 2));
