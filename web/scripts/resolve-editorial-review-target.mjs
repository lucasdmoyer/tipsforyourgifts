import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { highRiskClaimsForRun, requireCurrentFounderSafetyApproval, reviewedContentDigests } from './lib/editorial-safety-contract.mjs';
import { loadEditorialSafetyApprovalRecords } from './lib/editorial-safety-store.mjs';
import {
  assertReviewReceiptIdentity,
  nextReviewRevision,
  receiptMatchesCurrentContent,
  reviewReceiptPath
} from './lib/editorial-review-receipt-contract.mjs';
import { researchMissionSchema } from './lib/research-mission-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const root = process.cwd();
const requestedRunId = args['run-id'] || null;
const safetyApprovalRecords = await loadEditorialSafetyApprovalRecords(root);
const missionDirectory = path.join(root, 'research', 'missions');
let missionNames = [];
try { missionNames = (await fs.readdir(missionDirectory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const missions = [];
for (const name of missionNames) {
  missions.push(researchMissionSchema.parse(JSON.parse(await fs.readFile(path.join(missionDirectory, name), 'utf8'))));
}
const reviewDirectory = path.join(root, 'research', 'reviews');
let reviewNames = [];
try { reviewNames = (await fs.readdir(reviewDirectory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const reviewRecords = [];
for (const name of reviewNames) {
  const relativePath = `research/reviews/${name}`;
  const raw = await fs.readFile(path.join(reviewDirectory, name));
  reviewRecords.push({ name, relativePath, data: assertReviewReceiptIdentity(JSON.parse(raw.toString('utf8')), relativePath) });
}

const runDirectory = path.join(root, 'research', 'runs');
const runNames = requestedRunId ? [`${requestedRunId}.json`] : (await fs.readdir(runDirectory)).filter((name) => name.endsWith('.json')).sort();
const eligible = [];
const ineligible = [];

for (const name of runNames) {
  let runRaw;
  try { runRaw = await fs.readFile(path.join(runDirectory, name)); } catch (error) {
    if (requestedRunId && error.code === 'ENOENT') throw new Error(`Requested research run does not exist: ${requestedRunId}`);
    throw error;
  }
  const run = JSON.parse(runRaw.toString('utf8'));
  if (!['drafted', 'qa_failed'].includes(run.status)) {
    ineligible.push({ runId: run.runId, reason: `status_${run.status}` });
    continue;
  }
  const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`));
  let socialRaw = null;
  try { socialRaw = await fs.readFile(path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try {
    if (highRiskClaimsForRun(run).length === 0) throw new Error('run_has_no_high_risk_claims');
    const safety = requireCurrentFounderSafetyApproval({
      run,
      currentReviewedContentSha256: reviewedContentDigests({ run, articleRaw, socialRaw }),
      approvals: safetyApprovalRecords.map((record) => record.data)
    });
    if (safety.status !== 'approved_current') throw new Error('founder_safety_approval_is_not_current');
  } catch (error) {
    ineligible.push({ runId: run.runId, reason: error.message });
    continue;
  }
  const runReviews = reviewRecords.filter((record) => record.data.runId === run.runId);
  const currentReviews = runReviews
    .filter((record) => receiptMatchesCurrentContent({ receipt: record.data, run, articleRaw, socialRaw }))
    .sort((left, right) => (right.data.receiptRevision ?? 1) - (left.data.receiptRevision ?? 1));
  if (currentReviews.length > 0) {
    const latest = currentReviews[0].data;
    ineligible.push({ runId: run.runId, reason: latest.verdict === 'passed' ? 'current_content_already_passed_independent_review' : 'current_content_already_failed_independent_review' });
    continue;
  }
  const nextRevision = nextReviewRevision(reviewNames, run.runId);
  const matchingMissions = missions.filter((mission) => mission.status === 'started'
    && mission.idea?.id === run.ideaId
    && mission.idea?.revision === run.ideaRevision
    && mission.idea?.sha256 === run.ideaSha256);
  if (matchingMissions.length > 1) throw new Error(`${run.runId}: multiple started missions match the research bundle`);
  eligible.push({
    runId: run.runId,
    articleSlug: run.article.slug,
    missionId: matchingMissions[0]?.missionId ?? null,
    nextRevision,
    expectedReceiptPath: reviewReceiptPath(run.runId, nextRevision)
  });
}

if (requestedRunId && eligible.length !== 1) {
  const reason = ineligible.find((entry) => entry.runId === requestedRunId)?.reason ?? 'not_eligible';
  throw new Error(`${requestedRunId}: independent re-review is not eligible (${reason})`);
}
if (!requestedRunId && eligible.length > 1) throw new Error(`Multiple bundles are eligible for automatic independent re-review: ${eligible.map((entry) => entry.runId).join(', ')}`);

const target = eligible[0] ?? null;
if (process.env.GITHUB_OUTPUT) {
  const lines = target
    ? `eligible=true\nrun_id=${target.runId}\narticle_slug=${target.articleSlug}\nmission_id=${target.missionId ?? ''}\nnext_revision=${target.nextRevision}\nexpected_receipt_path=${target.expectedReceiptPath}\n`
    : 'eligible=false\n';
  await fs.appendFile(process.env.GITHUB_OUTPUT, lines);
}
console.log(JSON.stringify({
  eligible: Boolean(target),
  target,
  ineligible,
  founderSafetyApprovalRequired: true,
  publicationAuthorized: false
}, null, 2));
