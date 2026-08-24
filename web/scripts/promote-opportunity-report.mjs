import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { canonicalIdeaSha256 } from './lib/research-mission-contract.mjs';
import { opportunityReportSchema, opportunityReviewReceiptSchema, opportunityScoutMissionSchema, sha256 } from './lib/opportunity-scout-contract.mjs';

const scoutId = process.argv[2];
if (!scoutId) throw new Error('Usage: node scripts/promote-opportunity-report.mjs <scout-id>');
const root = process.cwd();
const missionPath = path.join(root, 'research/opportunity-missions', `${scoutId}.json`);
const reportPath = path.join(root, 'research/opportunities', `${scoutId}.json`);
const receiptPath = path.join(root, 'research/opportunity-reviews', `${scoutId}.qa.v1.json`);
const [missionRaw, reportRaw, receipt, strategy] = await Promise.all([
  fs.readFile(missionPath),
  fs.readFile(reportPath),
  fs.readFile(receiptPath, 'utf8').then(JSON.parse).then((value) => opportunityReviewReceiptSchema.parse(value)),
  fs.readFile(path.join(root, 'src/data/strategy.json'), 'utf8').then(JSON.parse)
]);
const mission = opportunityScoutMissionSchema.parse(JSON.parse(missionRaw));
const report = opportunityReportSchema.parse(JSON.parse(reportRaw));
if (mission.status !== 'started' || report.status !== 'drafted' || report.qa !== null) throw new Error('Opportunity scout is not awaiting promotion');
if (receipt.verdict !== 'passed' || receipt.blockers.length > 0) throw new Error('Independent opportunity review did not pass cleanly');
if (receipt.reviewerId === report.draftAuthor) throw new Error('Scout author cannot review their own report');
if (receipt.startedMissionSha256 !== sha256(missionRaw)) throw new Error('Opportunity mission changed after the model received it');
if (receipt.draftReportSha256 !== sha256(reportRaw)) throw new Error('Opportunity report changed after independent review');
const proposal = strategy.ideas.find((idea) => idea.id === report.selectedProposal.proposalId);
if (!proposal || receipt.proposalSha256 !== canonicalIdeaSha256(proposal)) throw new Error('Strategy proposal changed after independent review');

report.status = 'validated';
report.qa = {
  passed: true,
  reviewerRole: 'independent-opportunity-editor',
  reviewerId: receipt.reviewerId,
  receiptPath: `research/opportunity-reviews/${scoutId}.qa.v1.json`,
  draftReportSha256: receipt.draftReportSha256,
  startedMissionSha256: receipt.startedMissionSha256,
  warnings: receipt.warnings
};
mission.status = 'completed';
mission.completedAt = receipt.reviewedAt;
mission.completion = {
  reportId: scoutId,
  proposalId: report.selectedProposal.proposalId,
  reviewReceiptPath: report.qa.receiptPath
};
opportunityReportSchema.parse(report);
opportunityScoutMissionSchema.parse(mission);
await Promise.all([
  fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`),
  fs.writeFile(missionPath, `${JSON.stringify(mission, null, 2)}\n`)
]);
console.log(JSON.stringify({ scoutId, status: report.status, proposalId: report.selectedProposal.proposalId, nextGate: 'founder_review' }, null, 2));
