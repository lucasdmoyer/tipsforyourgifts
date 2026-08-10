import { canonicalIdeaSha256, sha256, validateResearchMissionRecords } from './lib/research-mission-contract.mjs';

const copy = (value) => structuredClone(value);
const idea = {
  id: 'founder-idea-003', revision: 1, ideaType: 'content', thesisType: 'recipient_friction',
  founderDisposition: 'approved_for_research', title: 'If you have a golf friend: solve the frictions they tolerate'
};
const strategy = { thoughtfulnessFramework: { minimumPairCoherenceScore: 80 }, ideas: [idea] };
const publicationPolicy = {
  mode: 'founder_reviewed',
  automaticPromotion: { enabled: false, verifiedSuccessfulReleaseCount: 0, minimumSuccessfulFounderReviewedReleases: 10 }
};
const run = {
  runId: '20260803-gifts-for-golf-friend-53cb00a5', ideaId: idea.id, ideaRevision: idea.revision,
  ideaSha256: canonicalIdeaSha256(idea), status: 'validated', article: { slug: 'gifts-for-a-golf-friend', status: 'publication_ready' },
  qa: { passed: true, receiptPath: 'research/reviews/20260803-gifts-for-golf-friend-53cb00a5.qa.v1.json' }
};
const articleRaw = Buffer.from('---\nstatus: publication_ready\n---\nEvidence-backed article.\n');
const social = { packId: 'gifts-for-a-golf-friend-launch', researchRun: run.runId };
const review = { runId: run.runId, workflowRunId: '123', verdict: 'passed', blockers: [] };
const runRaw = Buffer.from(JSON.stringify(run));
const socialRaw = Buffer.from(JSON.stringify(social));
const reviewRaw = Buffer.from(JSON.stringify(review));

function startedMission(workflowRunId = '123') {
  return {
    schemaVersion: '1.0.0', missionId: `research-mission-${workflowRunId}-1`, status: 'started',
    createdAt: '2026-08-03T10:00:00.000Z', completedAt: null,
    trigger: { type: 'approved_strategy_dispatch', workflow: 'research-agent.yml', workflowRunId, workflowRunAttempt: 1, actor: 'lucasdmoyer', baseSha: 'a'.repeat(40) },
    idea: { id: idea.id, revision: idea.revision, sha256: canonicalIdeaSha256(idea), title: idea.title, thesisType: idea.thesisType },
    teamStages: [
      { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'in_progress' },
      { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'queued' },
      { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
      { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
    ],
    deliverables: { researchRuns: 1, articles: 1, socialLaunchPacks: 1, independentReviewReceipts: 1 },
    qualityGates: {
      minimumResearchPasses: 3, minimumSourceClasses: 5, minimumFinalists: 5, minimumEditorialScore: 75,
      minimumEvidenceConfidence: 70, minimumThoughtfulnessScore: 15, minimumPairCoherenceScore: 80,
      independentReviewerRequired: true, affiliatePosture: 'enabled_registry_only'
    },
    publicationPolicySnapshot: { mode: 'founder_reviewed', automaticPromotionEnabled: false, verifiedSuccessfulReleaseCount: 0, minimumSuccessfulFounderReviewedReleases: 10 },
    completion: null
  };
}

function completedMission() {
  const mission = startedMission();
  mission.status = 'completed';
  mission.completedAt = '2026-08-03T11:00:00.000Z';
  mission.teamStages[0].status = 'completed';
  mission.teamStages[1].status = 'completed';
  mission.teamStages[2].status = 'ready';
  mission.completion = {
    runId: run.runId, runSha256: sha256(runRaw), articleSlug: run.article.slug, articleSha256: sha256(articleRaw),
    socialPackId: social.packId, socialPackSha256: sha256(socialRaw), reviewReceiptPath: run.qa.receiptPath,
    reviewReceiptSha256: sha256(reviewRaw), publicationReadiness: 'founder_review_required',
    nextGate: 'Open the exact-SHA pull request and review its Firebase preview before the founder merge decision.'
  };
  return mission;
}

function model(mission = completedMission()) {
  return {
    records: [{ filename: `${mission.missionId}.json`, raw: Buffer.from(JSON.stringify(mission)), data: mission }],
    strategy: copy(strategy), publicationPolicy: copy(publicationPolicy),
    runsById: new Map([[run.runId, { raw: runRaw, data: copy(run) }]]),
    articlesBySlug: new Map([[run.article.slug, { raw: articleRaw, data: { slug: run.article.slug } }]]),
    socialByRunId: new Map([[run.runId, { raw: socialRaw, data: copy(social) }]]),
    reviewsByPath: new Map([[run.qa.receiptPath, { raw: reviewRaw, data: copy(review) }]])
  };
}

function assertValid(name, input) {
  const result = validateResearchMissionRecords(input);
  if (result.issues.length > 0) throw new Error(`${name} should pass: ${result.issues.join('; ')}`);
}
let checks = 0;
function expectFailure(name, mutate, expected) {
  const input = model();
  mutate(input);
  const result = validateResearchMissionRecords(input);
  if (!result.issues.join(' ').toLowerCase().includes(expected.toLowerCase())) throw new Error(`${name} did not fail with ${expected}: ${result.issues.join('; ')}`);
  checks += 1;
}

assertValid('valid started mission', model(startedMission()));
assertValid('valid completed mission', model());
expectFailure('filename binding', (input) => { input.records[0].filename = 'wrong.json'; }, 'filename must match');
expectFailure('mission ID binding', (input) => { input.records[0].data.missionId = 'research-mission-999-1'; }, 'mission id must match');
expectFailure('founder approval', (input) => { input.strategy.ideas[0].founderDisposition = 'proposed'; }, 'not founder-approved');
expectFailure('idea digest', (input) => { input.records[0].data.idea.sha256 = 'b'.repeat(64); }, 'idea digest mismatch');
expectFailure('stage order', (input) => { input.records[0].data.teamStages.reverse(); }, 'canonical order');
expectFailure('started completion evidence', (input) => { const mission = startedMission(); mission.completedAt = '2026-08-03T11:00:00.000Z'; input.records = [{ filename: `${mission.missionId}.json`, raw: Buffer.from('x'), data: mission }]; }, 'started mission cannot');
expectFailure('stale active policy', (input) => { const mission = startedMission(); mission.publicationPolicySnapshot.verifiedSuccessfulReleaseCount = 1; input.records = [{ filename: `${mission.missionId}.json`, raw: Buffer.from('x'), data: mission }]; }, 'policy snapshot is stale');
expectFailure('duplicate active mission', (input) => { const first = startedMission(); const second = startedMission('124'); input.records = [{ filename: `${first.missionId}.json`, raw: Buffer.from('1'), data: first }, { filename: `${second.missionId}.json`, raw: Buffer.from('2'), data: second }]; }, 'another active mission');
expectFailure('completed mission evidence', (input) => { input.records[0].data.completion = null; }, 'needs completion evidence');
expectFailure('run digest', (input) => { input.records[0].data.completion.runSha256 = 'c'.repeat(64); }, 'run digest mismatch');
expectFailure('run idea binding', (input) => { input.runsById.get(run.runId).data.ideaRevision = 2; }, 'not bound to the mission idea');
expectFailure('review workflow binding', (input) => { input.reviewsByPath.get(run.qa.receiptPath).data.workflowRunId = '999'; }, 'workflow run mismatch');
expectFailure('publication readiness', (input) => { input.records[0].data.completion.publicationReadiness = 'automatic_merge_eligible'; }, 'readiness differs');

console.log(JSON.stringify({ researchMissionNegativeGateTests: 'passed', checks, validStartedMission: 'passed', validCompletedMission: 'passed' }, null, 2));
