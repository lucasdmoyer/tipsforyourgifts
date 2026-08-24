import crypto from 'node:crypto';
import { z } from 'zod';
import { canonicalIdeaSha256 } from './research-mission-contract.mjs';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const scoutIdSchema = z.string().regex(/^opportunity-scout-[1-9]\d*-[1-9]\d*$/);
const ideaIdSchema = z.string().regex(/^founder-idea-\d{3}$/);
const sourceIdSchema = z.string().regex(/^opp-source-[a-z0-9]+(?:-[a-z0-9]+)*$/);
const signalIdSchema = z.string().regex(/^opp-signal-[a-z0-9]+(?:-[a-z0-9]+)*$/);
const candidateIdSchema = z.string().regex(/^opp-candidate-[a-z0-9]+(?:-[a-z0-9]+)*$/);

const opportunityScoutPolicyBaseSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  enabled: z.boolean(),
  cadence: z.literal('weekly'),
  maxOpenProposals: z.number().int().min(1).max(20),
  minimumResearchPasses: z.number().int().min(3).max(10),
  minimumSources: z.number().int().min(10).max(100),
  minimumSourceClasses: z.number().int().min(5).max(8),
  minimumPublicSocialOrCommunitySources: z.number().int().min(2).max(20),
  minimumCandidates: z.number().int().min(3).max(7),
  maximumCandidates: z.number().int().min(3).max(7),
  minimumSignals: z.number().int().min(6).max(30),
  minimumEvidenceConfidence: z.number().int().min(70).max(100),
  minimumThoughtfulnessPotential: z.number().int().min(80).max(100),
  diminishingReturnThreshold: z.number().min(0.05).max(0.2),
  requiredConsecutiveLowNoveltyPasses: z.literal(2),
  geography: z.string().min(3),
  language: z.string().min(3),
  socialEvidencePolicy: z.literal('public_only_no_personal_identifiers')
}).strict();

export const opportunityScoutPolicySchema = opportunityScoutPolicyBaseSchema.superRefine((policy, context) => {
  if (policy.maximumCandidates < policy.minimumCandidates) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maximumCandidates'], message: 'maximumCandidates must be at least minimumCandidates' });
  }
});

const policySnapshotSchema = opportunityScoutPolicyBaseSchema.omit({ updatedAt: true });

export const opportunityScoutMissionSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  missionId: scoutIdSchema,
  status: z.enum(['started', 'completed']),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  trigger: z.object({
    type: z.enum(['scheduled', 'manual']),
    workflow: z.literal('opportunity-scout.yml'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    workflowRunAttempt: z.number().int().positive(),
    actor: z.string().regex(/^[A-Za-z0-9-]+(?:\[bot\])?$/),
    baseSha: gitShaSchema
  }).strict(),
  expectedProposalId: ideaIdSchema,
  openProposalCountAtStart: z.number().int().nonnegative(),
  authority: z.object({
    mayAppendOneProposedIdea: z.literal(true),
    mayApproveResearch: z.literal(false),
    mayPublish: z.literal(false),
    mayChangeAccountsOrSpend: z.literal(false)
  }).strict(),
  policySnapshot: policySnapshotSchema,
  completion: z.object({
    reportId: scoutIdSchema,
    proposalId: ideaIdSchema,
    reviewReceiptPath: z.string().regex(/^research\/opportunity-reviews\/opportunity-scout-[1-9]\d*-[1-9]\d*\.qa\.v1\.json$/)
  }).strict().nullable()
}).strict();

const sourceClassSchema = z.enum([
  'manufacturer_category',
  'merchant_catalog',
  'independent_editorial',
  'public_social',
  'public_community',
  'trend_calendar',
  'safety_authority',
  'search_discovery'
]);

const opportunitySourceSchema = z.object({
  id: sourceIdSchema,
  url: z.string().url().refine((value) => value.startsWith('https://'), 'sources must use HTTPS'),
  publisher: z.string().min(2),
  title: z.string().min(5),
  accessedAt: z.string().datetime(),
  sourceClass: sourceClassSchema,
  trustTier: z.enum(['A', 'B', 'C', 'D']),
  independenceGroup: z.string().min(2),
  publicContent: z.literal(true),
  containsPersonalIdentifiers: z.literal(false)
}).strict();

const opportunitySignalSchema = z.object({
  id: signalIdSchema,
  kind: z.enum([
    'recipient_language',
    'observed_workaround',
    'self_purchase_gap',
    'pairing_behavior',
    'seasonal_timing',
    'editorial_gap',
    'commercial_breadth'
  ]),
  summary: z.string().min(30),
  interpretation: z.string().min(30),
  limitations: z.string().min(20),
  sourceIds: z.array(sourceIdSchema).min(2)
}).strict();

const candidateScoreSchema = z.object({
  evidenceConfidence: z.number().int().min(0).max(100),
  thoughtfulnessPotential: z.number().int().min(0).max(100),
  differentiation: z.number().int().min(0).max(100),
  evergreenValue: z.number().int().min(0).max(100),
  productionFeasibility: z.number().int().min(0).max(100),
  total: z.number().int().min(0).max(100)
}).strict();

const opportunityCandidateSchema = z.object({
  id: candidateIdSchema,
  title: z.string().min(12),
  audience: z.string().min(12),
  observedFriction: z.string().min(40),
  selfPurchaseGap: z.string().min(30),
  pairingHypothesis: z.string().min(30).nullable(),
  whyNow: z.string().min(30),
  editorialGap: z.string().min(30),
  monetizationPosture: z.enum(['broad_catalog_candidate', 'specialist_candidate', 'ordinary_links_only', 'not_yet_researched']),
  commissionIndependent: z.literal(true),
  sourceIds: z.array(sourceIdSchema).min(3),
  rejectionConditions: z.array(z.string().min(20)).min(2),
  score: candidateScoreSchema
}).strict().superRefine((candidate, context) => {
  const components = ['evidenceConfidence', 'thoughtfulnessPotential', 'differentiation', 'evergreenValue', 'productionFeasibility'];
  const expected = Math.round(components.reduce((sum, key) => sum + candidate.score[key], 0) / components.length);
  if (candidate.score.total !== expected) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['score', 'total'], message: `total must equal the rounded component average: ${expected}` });
  }
});

export const opportunityReportSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  scoutId: scoutIdSchema,
  missionId: scoutIdSchema,
  status: z.enum(['drafted', 'validated']),
  createdAt: z.string().datetime(),
  draftAuthor: z.string().min(3),
  scope: z.object({
    geography: z.string().min(3),
    language: z.string().min(3),
    horizon: z.enum(['evergreen', 'next_90_days', 'mixed']),
    sensitiveCategoriesExcluded: z.literal(true)
  }).strict(),
  researchPasses: z.array(z.object({
    pass: z.number().int().positive(),
    objective: z.string().min(20),
    queries: z.array(z.string().min(8)).min(2),
    newSignals: z.number().int().nonnegative(),
    materialNoveltyRate: z.number().min(0).max(1)
  }).strict()).min(3),
  sources: z.array(opportunitySourceSchema).min(10),
  signals: z.array(opportunitySignalSchema).min(6),
  candidates: z.array(opportunityCandidateSchema).min(3).max(7),
  selectedProposal: z.object({
    proposalId: ideaIdSchema,
    candidateId: candidateIdSchema,
    title: z.string().min(12),
    rationale: z.string().min(50),
    sourceIds: z.array(sourceIdSchema).min(3)
  }).strict(),
  conflicts: z.array(z.string().min(20)),
  unknowns: z.array(z.string().min(20)).min(2),
  commercialBoundary: z.object({
    commissionIndependent: z.literal(true),
    revenueClaimsMade: z.literal(false),
    affiliateEnrollmentChanged: z.literal(false)
  }).strict(),
  qa: z.object({
    passed: z.literal(true),
    reviewerRole: z.literal('independent-opportunity-editor'),
    reviewerId: z.string().min(3),
    receiptPath: z.string().regex(/^research\/opportunity-reviews\/opportunity-scout-[1-9]\d*-[1-9]\d*\.qa\.v1\.json$/),
    draftReportSha256: sha256Schema,
    startedMissionSha256: sha256Schema,
    warnings: z.array(z.string())
  }).strict().nullable()
}).strict();

export const opportunityReviewReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: z.string().regex(/^opportunity-scout-[1-9]\d*-[1-9]\d*-qa$/),
  scoutId: scoutIdSchema,
  reviewedAt: z.string().datetime(),
  reviewerRole: z.literal('independent-opportunity-editor'),
  reviewerId: z.string().min(3),
  workflowRunId: z.string().regex(/^[1-9]\d*$/),
  verdict: z.enum(['passed', 'failed']),
  startedMissionSha256: sha256Schema,
  draftReportSha256: sha256Schema,
  proposalSha256: sha256Schema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string())
}).strict();

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function recordDigest(record) {
  return record?.raw == null ? null : sha256(record.raw);
}

export function nextStrategyIdeaId(ideas) {
  const highest = ideas.reduce((maximum, idea) => {
    const match = /^founder-idea-(\d{3})$/.exec(idea.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `founder-idea-${String(highest + 1).padStart(3, '0')}`;
}

function addSchemaIssues(issues, filename, parsed) {
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) issues.push(`${filename} ${issue.path.join('.')}: ${issue.message}`);
  return null;
}

export function validateOpportunityScoutRecords({ policy, missions, reports, reviews, strategy }) {
  const issues = [];
  const parsedPolicy = opportunityScoutPolicySchema.safeParse(policy);
  if (!parsedPolicy.success) {
    for (const issue of parsedPolicy.error.issues) issues.push(`policy ${issue.path.join('.')}: ${issue.message}`);
    return { issues, missions: [], reports: [], reviews: [] };
  }
  const currentPolicy = parsedPolicy.data;
  const parsedMissions = [];
  const parsedReports = [];
  const parsedReviews = [];
  const missionIds = new Set();
  const reportIds = new Set();
  const reviewIds = new Set();

  for (const record of missions) {
    const mission = addSchemaIssues(issues, record.filename, opportunityScoutMissionSchema.safeParse(record.data));
    if (!mission) continue;
    parsedMissions.push({ ...record, data: mission });
    if (record.filename !== `${mission.missionId}.json`) issues.push(`${mission.missionId}: mission filename must match missionId`);
    if (missionIds.has(mission.missionId)) issues.push(`${mission.missionId}: duplicate mission ID`);
    missionIds.add(mission.missionId);
    if (mission.missionId !== `opportunity-scout-${mission.trigger.workflowRunId}-${mission.trigger.workflowRunAttempt}`) issues.push(`${mission.missionId}: mission ID must match workflow run and attempt`);
    if (mission.status === 'started') {
      if (mission.completedAt !== null || mission.completion !== null) issues.push(`${mission.missionId}: started mission cannot contain completion evidence`);
      const snapshot = { ...currentPolicy };
      delete snapshot.updatedAt;
      if (JSON.stringify(mission.policySnapshot) !== JSON.stringify(snapshot)) issues.push(`${mission.missionId}: active mission policy snapshot is stale`);
    } else if (mission.completedAt === null || mission.completion === null) {
      issues.push(`${mission.missionId}: completed mission needs completion evidence`);
    }
  }

  const missionsById = new Map(parsedMissions.map((record) => [record.data.missionId, record]));
  const ideasById = new Map(strategy.ideas.map((idea) => [idea.id, idea]));

  for (const record of reports) {
    const report = addSchemaIssues(issues, record.filename, opportunityReportSchema.safeParse(record.data));
    if (!report) continue;
    parsedReports.push({ ...record, data: report });
    if (record.filename !== `${report.scoutId}.json`) issues.push(`${report.scoutId}: report filename must match scoutId`);
    if (reportIds.has(report.scoutId)) issues.push(`${report.scoutId}: duplicate report ID`);
    reportIds.add(report.scoutId);
    if (report.missionId !== report.scoutId) issues.push(`${report.scoutId}: missionId must equal scoutId`);
    const missionRecord = missionsById.get(report.missionId);
    if (!missionRecord) issues.push(`${report.scoutId}: trusted mission is missing`);
    else if (missionRecord.data.expectedProposalId !== report.selectedProposal.proposalId) issues.push(`${report.scoutId}: selected proposal differs from the mission envelope`);

    const proposal = ideasById.get(report.selectedProposal.proposalId);
    if (!proposal) issues.push(`${report.scoutId}: selected strategy proposal is missing`);
    else {
      if (proposal.founderDisposition !== 'proposed') issues.push(`${report.scoutId}: autonomous scout proposal must remain proposed`);
      if (proposal.title !== report.selectedProposal.title) issues.push(`${report.scoutId}: selected proposal title differs from strategy`);
    }

    if (report.scope.geography !== currentPolicy.geography || report.scope.language !== currentPolicy.language) issues.push(`${report.scoutId}: report scope differs from policy`);
    if (report.researchPasses.length < currentPolicy.minimumResearchPasses) issues.push(`${report.scoutId}: too few research passes`);
    report.researchPasses.forEach((pass, index) => { if (pass.pass !== index + 1) issues.push(`${report.scoutId}: research passes must be sequential`); });
    const tail = report.researchPasses.slice(-currentPolicy.requiredConsecutiveLowNoveltyPasses);
    if (tail.length < currentPolicy.requiredConsecutiveLowNoveltyPasses || tail.some((pass) => pass.materialNoveltyRate >= currentPolicy.diminishingReturnThreshold)) issues.push(`${report.scoutId}: research did not reach two consecutive low-novelty passes`);

    const sourceIds = new Set(report.sources.map((source) => source.id));
    if (sourceIds.size !== report.sources.length) issues.push(`${report.scoutId}: source IDs must be unique`);
    if (report.sources.length < currentPolicy.minimumSources) issues.push(`${report.scoutId}: too few sources`);
    if (new Set(report.sources.map((source) => source.sourceClass)).size < currentPolicy.minimumSourceClasses) issues.push(`${report.scoutId}: too few source classes`);
    const socialSources = report.sources.filter((source) => ['public_social', 'public_community'].includes(source.sourceClass));
    if (socialSources.length < currentPolicy.minimumPublicSocialOrCommunitySources) issues.push(`${report.scoutId}: too few public social or community sources`);
    if (new Set(socialSources.map((source) => source.independenceGroup)).size < Math.min(2, currentPolicy.minimumPublicSocialOrCommunitySources)) issues.push(`${report.scoutId}: social or community sources need distinct independence groups`);

    const assertSourceRefs = (label, ids, minimum) => {
      if (ids.length < minimum) issues.push(`${report.scoutId}: ${label} has too few source references`);
      for (const id of ids) if (!sourceIds.has(id)) issues.push(`${report.scoutId}: ${label} references unknown source ${id}`);
    };
    if (report.signals.length < currentPolicy.minimumSignals) issues.push(`${report.scoutId}: too few opportunity signals`);
    const signalKinds = new Set(report.signals.map((signal) => signal.kind));
    for (const required of ['recipient_language', 'observed_workaround', 'self_purchase_gap', 'editorial_gap']) if (!signalKinds.has(required)) issues.push(`${report.scoutId}: missing ${required} signal`);
    for (const signal of report.signals) assertSourceRefs(`signal ${signal.id}`, signal.sourceIds, 2);
    if (report.candidates.length < currentPolicy.minimumCandidates || report.candidates.length > currentPolicy.maximumCandidates) issues.push(`${report.scoutId}: candidate count is outside policy`);
    const candidateIds = new Set(report.candidates.map((candidate) => candidate.id));
    if (candidateIds.size !== report.candidates.length) issues.push(`${report.scoutId}: candidate IDs must be unique`);
    for (const candidate of report.candidates) assertSourceRefs(`candidate ${candidate.id}`, candidate.sourceIds, 3);
    const selected = report.candidates.find((candidate) => candidate.id === report.selectedProposal.candidateId);
    if (!selected) issues.push(`${report.scoutId}: selected candidate is missing`);
    else {
      if (selected.score.evidenceConfidence < currentPolicy.minimumEvidenceConfidence) issues.push(`${report.scoutId}: selected candidate evidence confidence is below policy`);
      if (selected.score.thoughtfulnessPotential < currentPolicy.minimumThoughtfulnessPotential) issues.push(`${report.scoutId}: selected candidate thoughtfulness potential is below policy`);
      if (proposal && ['story_pairing', 'ritual_pairing'].includes(proposal.thesisType) && (!selected.pairingHypothesis || !signalKinds.has('pairing_behavior'))) issues.push(`${report.scoutId}: pairing proposal lacks pairing evidence`);
    }
    assertSourceRefs('selected proposal', report.selectedProposal.sourceIds, 3);

    if (report.status === 'drafted') {
      if (report.qa !== null) issues.push(`${report.scoutId}: drafted report cannot contain QA approval`);
      if (missionRecord?.data.status !== 'started') issues.push(`${report.scoutId}: drafted report requires a started mission`);
    } else {
      if (!report.qa) issues.push(`${report.scoutId}: validated report needs QA evidence`);
      if (missionRecord?.data.status !== 'completed') issues.push(`${report.scoutId}: validated report requires a completed mission`);
    }
  }

  for (const record of reviews) {
    const review = addSchemaIssues(issues, record.filename, opportunityReviewReceiptSchema.safeParse(record.data));
    if (!review) continue;
    parsedReviews.push({ ...record, data: review });
    if (record.filename !== `${review.scoutId}.qa.v1.json`) issues.push(`${review.scoutId}: review filename must match scoutId`);
    if (reviewIds.has(review.receiptId)) issues.push(`${review.receiptId}: duplicate review receipt`);
    reviewIds.add(review.receiptId);
    const missionRecord = missionsById.get(review.scoutId);
    const reportRecord = parsedReports.find((candidate) => candidate.data.scoutId === review.scoutId);
    if (!missionRecord || !reportRecord) issues.push(`${review.scoutId}: review requires mission and report`);
    if (reportRecord && review.reviewerId === reportRecord.data.draftAuthor) issues.push(`${review.scoutId}: scout author cannot review their own report`);
    if (review.verdict === 'passed' && review.blockers.length > 0) issues.push(`${review.scoutId}: passing review cannot contain blockers`);
    if (review.verdict === 'failed' && review.blockers.length === 0) issues.push(`${review.scoutId}: failed review must name a blocker`);
    const proposal = reportRecord ? ideasById.get(reportRecord.data.selectedProposal.proposalId) : null;
    if (proposal && review.proposalSha256 !== canonicalIdeaSha256(proposal)) issues.push(`${review.scoutId}: proposal digest mismatch`);
    if (missionRecord?.data.status === 'started' && review.startedMissionSha256 !== recordDigest(missionRecord)) issues.push(`${review.scoutId}: started mission digest mismatch`);
    if (reportRecord?.data.status === 'drafted' && review.draftReportSha256 !== recordDigest(reportRecord)) issues.push(`${review.scoutId}: draft report digest mismatch`);
    if (reportRecord?.data.qa) {
      if (reportRecord.data.qa.draftReportSha256 !== review.draftReportSha256) issues.push(`${review.scoutId}: draft report digest differs from QA receipt`);
      if (reportRecord.data.qa.startedMissionSha256 !== review.startedMissionSha256) issues.push(`${review.scoutId}: started mission digest differs from QA receipt`);
      if (reportRecord.data.qa.reviewerId !== review.reviewerId) issues.push(`${review.scoutId}: reviewer identity differs from QA receipt`);
    }
  }

  const reviewsByScout = new Map(parsedReviews.map((record) => [record.data.scoutId, record]));
  for (const reportRecord of parsedReports.filter((record) => record.data.status === 'validated')) {
    const report = reportRecord.data;
    const review = reviewsByScout.get(report.scoutId)?.data;
    if (!review || review.verdict !== 'passed' || review.blockers.length > 0) issues.push(`${report.scoutId}: validated report lacks a clean independent review`);
    const mission = missionsById.get(report.scoutId)?.data;
    if (mission?.completion && (mission.completion.reportId !== report.scoutId || mission.completion.proposalId !== report.selectedProposal.proposalId || mission.completion.reviewReceiptPath !== report.qa?.receiptPath)) issues.push(`${report.scoutId}: mission completion differs from report handoff`);
  }

  for (const missionRecord of parsedMissions.filter((record) => record.data.status === 'completed')) {
    if (!reportIds.has(missionRecord.data.missionId)) issues.push(`${missionRecord.data.missionId}: completed mission report is missing`);
  }

  return {
    issues,
    missions: parsedMissions.map((record) => record.data),
    reports: parsedReports.map((record) => record.data),
    reviews: parsedReviews.map((record) => record.data)
  };
}

export function digestRecord(record) {
  return recordDigest(record);
}
