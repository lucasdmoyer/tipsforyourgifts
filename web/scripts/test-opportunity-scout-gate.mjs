import { sha256, validateOpportunityScoutRecords } from './lib/opportunity-scout-contract.mjs';
import { canonicalIdeaSha256 } from './lib/research-mission-contract.mjs';

const copy = (value) => structuredClone(value);
const scoutId = 'opportunity-scout-12345-1';
const proposal = {
  id: 'founder-idea-010',
  revision: 1,
  founderDisposition: 'proposed',
  ideaType: 'editorial',
  thesisType: 'ritual_pairing',
  title: 'Make a weather-watching ritual easier to begin'
};
const policy = {
  schemaVersion: '1.0.0',
  updatedAt: '2026-08-03T10:30:00.000Z',
  enabled: true,
  cadence: 'weekly',
  maxOpenProposals: 5,
  minimumResearchPasses: 3,
  minimumSources: 10,
  minimumSourceClasses: 5,
  minimumPublicSocialOrCommunitySources: 2,
  minimumCandidates: 3,
  maximumCandidates: 7,
  minimumSignals: 6,
  minimumEvidenceConfidence: 70,
  minimumThoughtfulnessPotential: 80,
  diminishingReturnThreshold: 0.1,
  requiredConsecutiveLowNoveltyPasses: 2,
  geography: 'United States',
  language: 'English',
  socialEvidencePolicy: 'public_only_no_personal_identifiers'
};
const policySnapshot = copy(policy);
delete policySnapshot.updatedAt;

const classes = ['manufacturer_category', 'merchant_catalog', 'independent_editorial', 'public_social', 'public_community', 'trend_calendar', 'safety_authority', 'search_discovery'];
const sources = Array.from({ length: 10 }, (_, index) => ({
  id: `opp-source-evidence-${index + 1}`,
  url: `https://example${index + 1}.com/research`,
  publisher: `Publisher ${index + 1}`,
  title: `Public research evidence source ${index + 1}`,
  accessedAt: '2026-08-03T11:00:00.000Z',
  sourceClass: classes[index % classes.length],
  trustTier: index < 2 ? 'A' : 'B',
  independenceGroup: `group-${index + 1}`,
  publicContent: true,
  containsPersonalIdentifiers: false
}));
const signalKinds = ['recipient_language', 'observed_workaround', 'self_purchase_gap', 'pairing_behavior', 'seasonal_timing', 'editorial_gap'];
const signals = signalKinds.map((kind, index) => ({
  id: `opp-signal-${kind.replaceAll('_', '-')}`,
  kind,
  summary: `Multiple public sources show a durable ${kind.replaceAll('_', ' ')} pattern for this recipient group.`,
  interpretation: `The pattern supports a specific gift decision rule without relying on a demographic stereotype.`,
  limitations: `Public discussion is directional evidence and does not prove every recipient shares this preference.`,
  sourceIds: [sources[index].id, sources[index + 1].id]
}));
const candidates = Array.from({ length: 3 }, (_, index) => ({
  id: `opp-candidate-weather-${index + 1}`,
  title: `Thoughtful weather ritual candidate number ${index + 1}`,
  audience: 'A curious friend who already notices changing weather patterns',
  observedFriction: 'They improvise observations and repeatedly lose useful context between one weather event and the next.',
  selfPurchaseGap: 'The small supporting tools feel optional and are repeatedly postponed.',
  pairingHypothesis: 'A visual reference and a simple observation aid create one repeatable noticing ritual.',
  whyNow: 'The concept is evergreen and can be tested without relying on a short-lived product trend.',
  editorialGap: 'Existing lists emphasize novelty objects more often than observable recipient behavior and fit checks.',
  monetizationPosture: 'broad_catalog_candidate',
  commissionIndependent: true,
  sourceIds: [sources[index].id, sources[index + 1].id, sources[index + 2].id],
  rejectionConditions: ['Reject when the recipient has not shown this specific curiosity.', 'Reject tools that require an unwanted account or complex maintenance.'],
  score: {
    evidenceConfidence: index === 0 ? 82 : 72,
    thoughtfulnessPotential: index === 0 ? 91 : 76,
    differentiation: index === 0 ? 84 : 70,
    evergreenValue: index === 0 ? 88 : 74,
    productionFeasibility: index === 0 ? 85 : 78,
    total: index === 0 ? 86 : 74
  }
}));
const startedMission = {
  schemaVersion: '1.0.0',
  missionId: scoutId,
  status: 'started',
  createdAt: '2026-08-03T10:45:00.000Z',
  completedAt: null,
  trigger: { type: 'scheduled', workflow: 'opportunity-scout.yml', workflowRunId: '12345', workflowRunAttempt: 1, actor: 'github-actions[bot]', baseSha: 'a'.repeat(40) },
  expectedProposalId: proposal.id,
  openProposalCountAtStart: 4,
  authority: { mayAppendOneProposedIdea: true, mayApproveResearch: false, mayPublish: false, mayChangeAccountsOrSpend: false },
  policySnapshot,
  completion: null
};
const draftedReport = {
  schemaVersion: '1.0.0',
  scoutId,
  missionId: scoutId,
  status: 'drafted',
  createdAt: '2026-08-03T11:30:00.000Z',
  draftAuthor: 'opportunity-researcher',
  scope: { geography: 'United States', language: 'English', horizon: 'mixed', sensitiveCategoriesExcluded: true },
  researchPasses: [
    { pass: 1, objective: 'Map recipient language, recurring friction, and visible workarounds.', queries: ['weather watching gift friction', 'weather hobby public discussion'], newSignals: 5, materialNoveltyRate: 0.7 },
    { pass: 2, objective: 'Challenge the first hypotheses across independent source classes.', queries: ['weather observation routine gift', 'weather journal self purchase gap'], newSignals: 1, materialNoveltyRate: 0.08 },
    { pass: 3, objective: 'Search explicitly for contradictions, risks, and editorial gaps.', queries: ['weather gadget clutter risk', 'weather gift compatibility concerns'], newSignals: 0, materialNoveltyRate: 0.04 }
  ],
  sources,
  signals,
  candidates,
  selectedProposal: { proposalId: proposal.id, candidateId: candidates[0].id, title: proposal.title, rationale: 'The selected thesis has the strongest evidence, a clear self-purchase gap, and a coherent interaction that can be rejected when fit is uncertain.', sourceIds: [sources[0].id, sources[1].id, sources[2].id] },
  conflicts: ['Public discussions disagree about whether simple analog tools or connected devices create less friction.'],
  unknowns: ['Exact product candidates and current prices still require article-level research.', 'Accessibility and storage needs vary by recipient and must be checked before selection.'],
  commercialBoundary: { commissionIndependent: true, revenueClaimsMade: false, affiliateEnrollmentChanged: false },
  qa: null
};

function model() {
  return {
    policy: copy(policy),
    strategy: { ideas: [copy(proposal)] },
    missions: [{ filename: `${scoutId}.json`, raw: Buffer.from(JSON.stringify(startedMission)), data: copy(startedMission) }],
    reports: [{ filename: `${scoutId}.json`, raw: Buffer.from(JSON.stringify(draftedReport)), data: copy(draftedReport) }],
    reviews: []
  };
}

function assertValid(name, input) {
  const result = validateOpportunityScoutRecords(input);
  if (result.issues.length > 0) throw new Error(`${name} should pass: ${result.issues.join('; ')}`);
}
let checks = 0;
function expectFailure(name, mutate, expected) {
  const input = model();
  mutate(input);
  const result = validateOpportunityScoutRecords(input);
  if (!result.issues.join(' ').toLowerCase().includes(expected.toLowerCase())) throw new Error(`${name} did not fail with ${expected}: ${result.issues.join('; ')}`);
  checks += 1;
}

function attachDraftReview(input, overrides = {}) {
  input.reviews = [{ filename: `${scoutId}.qa.v1.json`, raw: Buffer.from('receipt'), data: {
    schemaVersion: '1.0.0', receiptId: `${scoutId}-qa`, scoutId, reviewedAt: '2026-08-03T12:00:00.000Z', reviewerRole: 'independent-opportunity-editor', reviewerId: 'independent-editor',
    workflowRunId: '12345', verdict: 'passed', startedMissionSha256: sha256(input.missions[0].raw), draftReportSha256: sha256(input.reports[0].raw), proposalSha256: canonicalIdeaSha256(proposal), blockers: [], warnings: [],
    ...overrides
  }}];
}

assertValid('valid drafted scout', model());
expectFailure('mission filename binding', (input) => { input.missions[0].filename = 'wrong.json'; }, 'filename must match');
expectFailure('mission run binding', (input) => { input.missions[0].data.missionId = 'opportunity-scout-999-1'; }, 'mission ID must match');
expectFailure('stale policy', (input) => { input.missions[0].data.policySnapshot.minimumSources = 11; }, 'snapshot is stale');
expectFailure('proposal envelope', (input) => { input.missions[0].data.expectedProposalId = 'founder-idea-011'; }, 'differs from the mission envelope');
expectFailure('founder authority', (input) => { input.strategy.ideas[0].founderDisposition = 'approved_for_research'; }, 'must remain proposed');
expectFailure('research plateau', (input) => { input.reports[0].data.researchPasses[2].materialNoveltyRate = 0.1; }, 'low-novelty');
expectFailure('source classes', (input) => { input.reports[0].data.sources.forEach((source) => { source.sourceClass = 'independent_editorial'; }); }, 'too few source classes');
expectFailure('public social evidence', (input) => { input.reports[0].data.sources.forEach((source) => { if (source.sourceClass === 'public_social' || source.sourceClass === 'public_community') source.sourceClass = 'search_discovery'; }); }, 'too few public social');
expectFailure('social independence', (input) => { input.reports[0].data.sources.filter((source) => ['public_social', 'public_community'].includes(source.sourceClass)).forEach((source) => { source.independenceGroup = 'same-group'; }); }, 'distinct independence groups');
expectFailure('signal source binding', (input) => { input.reports[0].data.signals[0].sourceIds[0] = 'opp-source-missing'; }, 'unknown source');
expectFailure('required signal', (input) => { input.reports[0].data.signals[0].kind = 'commercial_breadth'; }, 'missing recipient_language');
expectFailure('candidate evidence threshold', (input) => { input.reports[0].data.candidates[0].score.evidenceConfidence = 69; input.reports[0].data.candidates[0].score.total = 83; }, 'evidence confidence is below');
expectFailure('candidate thoughtfulness threshold', (input) => { input.reports[0].data.candidates[0].score.thoughtfulnessPotential = 79; input.reports[0].data.candidates[0].score.total = 84; }, 'thoughtfulness potential is below');
expectFailure('pairing evidence', (input) => { input.reports[0].data.signals[3].kind = 'commercial_breadth'; }, 'lacks pairing evidence');
expectFailure('personal identifiers', (input) => { input.reports[0].data.sources[0].containsPersonalIdentifiers = true; }, 'expected false');
expectFailure('commission influence', (input) => { input.reports[0].data.commercialBoundary.commissionIndependent = false; }, 'expected true');
expectFailure('started mission digest', (input) => { attachDraftReview(input, { startedMissionSha256: 'b'.repeat(64) }); }, 'started mission digest mismatch');
expectFailure('draft report digest', (input) => { attachDraftReview(input, { draftReportSha256: 'b'.repeat(64) }); }, 'draft report digest mismatch');
expectFailure('proposal digest', (input) => { attachDraftReview(input, { proposalSha256: 'b'.repeat(64) }); }, 'proposal digest mismatch');
expectFailure('failed review blocker', (input) => { attachDraftReview(input, { verdict: 'failed' }); }, 'must name a blocker');
expectFailure('self-review', (input) => {
  const reportRaw = Buffer.from(JSON.stringify(draftedReport));
  attachDraftReview(input, { reviewerId: draftedReport.draftAuthor, draftReportSha256: sha256(reportRaw) });
  input.reports[0].data.status = 'validated';
  input.reports[0].data.qa = { passed: true, reviewerRole: 'independent-opportunity-editor', reviewerId: draftedReport.draftAuthor, receiptPath: `research/opportunity-reviews/${scoutId}.qa.v1.json`, draftReportSha256: sha256(reportRaw), startedMissionSha256: sha256(input.missions[0].raw), warnings: [] };
}, 'cannot review their own report');

console.log(JSON.stringify({ opportunityScoutNegativeGateTests: 'passed', checks, validDraftedScout: 'passed' }, null, 2));
