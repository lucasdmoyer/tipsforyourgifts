import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  approvalFilename,
  assessEditorialSafetyApproval,
  editorialSafetyPolicySchema,
  highRiskClaimsForRun,
  reviewedContentDigests
} from './lib/editorial-safety-contract.mjs';
import { loadEditorialSafetyApprovalRecords, latestEditorialSafetyApproval } from './lib/editorial-safety-store.mjs';

const root = process.cwd();
const policy = editorialSafetyPolicySchema.parse(JSON.parse(await fs.readFile(path.join(root, 'config', 'editorial-safety-policy.json'), 'utf8')));
const records = await loadEditorialSafetyApprovalRecords(root);
const issues = [];
const approvalIds = new Set();
const revisionKeys = new Set();
const runIds = [...new Set(records.map((record) => record.data.runId))];
const statusCounts = { approved_current: 0, rejected_current: 0, stale: 0 };
const legacyRunIds = new Set(policy.legacyValidatedHighRiskRunIds);

for (const record of records) {
  const approval = record.data;
  if (record.name !== approvalFilename(approval)) issues.push(`${record.name}: filename does not match approval identity`);
  if (approvalIds.has(approval.approvalId)) issues.push(`${record.name}: duplicate approval ID ${approval.approvalId}`);
  approvalIds.add(approval.approvalId);
  const revisionKey = `${approval.runId}:${approval.approvalRevision}`;
  if (revisionKeys.has(revisionKey)) issues.push(`${record.name}: duplicate run revision ${revisionKey}`);
  revisionKeys.add(revisionKey);
}

for (const runId of runIds) {
  const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
  let runRaw;
  try { runRaw = await fs.readFile(runPath); } catch { issues.push(`${runId}: referenced research run is missing`); continue; }
  const run = JSON.parse(runRaw.toString('utf8'));
  const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`));
  let socialRaw = null;
  try { socialRaw = await fs.readFile(path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const currentReviewedContentSha256 = reviewedContentDigests({ run, articleRaw, socialRaw });
  const latest = latestEditorialSafetyApproval(records, runId);
  const assessment = assessEditorialSafetyApproval({ approval: latest.data, run, currentReviewedContentSha256 });
  statusCounts[assessment.status] += 1;
  const revisions = records
    .filter((record) => record.data.runId === runId)
    .map((record) => record.data.approvalRevision)
    .sort((left, right) => left - right);
  revisions.forEach((revision, index) => { if (revision !== index + 1) issues.push(`${runId}: safety approval revisions must be contiguous from 1`); });
}

if (issues.length > 0) throw new Error(`Editorial safety approval validation failed:\n- ${issues.join('\n- ')}`);

const draftRunNames = (await fs.readdir(path.join(root, 'research', 'runs'))).filter((name) => name.endsWith('.json'));
let highRiskDraftsWithoutCurrentApproval = 0;
for (const name of draftRunNames) {
  const run = JSON.parse(await fs.readFile(path.join(root, 'research', 'runs', name), 'utf8'));
  const highRiskClaims = highRiskClaimsForRun(run);
  if (legacyRunIds.has(run.runId)) {
    if (run.status !== 'validated' || highRiskClaims.length === 0) issues.push(`${run.runId}: legacy safety disposition applies only to a validated run with high-risk claims`);
    if (!run.completedAt || new Date(run.completedAt) >= new Date(policy.effectiveAt)) issues.push(`${run.runId}: legacy safety disposition must predate the active gate`);
  }
  if (run.status === 'validated' && highRiskClaims.length > 0 && !legacyRunIds.has(run.runId) && !latestEditorialSafetyApproval(records, run.runId)) {
    issues.push(`${run.runId}: validated high-risk run has neither a current approval nor an explicit pre-policy disposition`);
  }
  if (!['drafted', 'qa_failed'].includes(run.status) || highRiskClaims.length === 0) continue;
  const latest = latestEditorialSafetyApproval(records, run.runId);
  if (!latest) { highRiskDraftsWithoutCurrentApproval += 1; continue; }
  const runRaw = await fs.readFile(path.join(root, 'research', 'runs', name));
  const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`));
  let socialRaw = null;
  try { socialRaw = await fs.readFile(path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const assessment = assessEditorialSafetyApproval({ approval: latest.data, run, currentReviewedContentSha256: reviewedContentDigests({ run, articleRaw, socialRaw }) });
  if (assessment.status !== 'approved_current') highRiskDraftsWithoutCurrentApproval += 1;
}

for (const runId of legacyRunIds) {
  if (!draftRunNames.includes(`${runId}.json`)) issues.push(`${runId}: legacy safety policy references a missing run`);
}

if (issues.length > 0) throw new Error(`Editorial safety approval validation failed:\n- ${issues.join('\n- ')}`);

console.log(JSON.stringify({
  gate: 'passed',
  approvals: records.length,
  ...statusCounts,
  legacyIndependentReviewOnly: legacyRunIds.size,
  highRiskDraftsWithoutCurrentApproval,
  founderApprovalFabricated: false,
  publicationAuthorized: false
}, null, 2));
