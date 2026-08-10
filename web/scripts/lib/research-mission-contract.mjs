import crypto from 'node:crypto';
import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const missionIdSchema = z.string().regex(/^research-mission-[1-9]\d*-[1-9]\d*$/);
const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const missionStageSchema = z.discriminatedUnion('id', [
  z.object({ id: z.literal('research'), role: z.literal('research-editorial-team'), authority: z.literal('draft_only'), status: z.enum(['queued', 'in_progress', 'completed']) }).strict(),
  z.object({ id: z.literal('quality_review'), role: z.literal('independent-evidence-editor'), authority: z.literal('review_receipt_only'), status: z.enum(['queued', 'in_progress', 'completed']) }).strict(),
  z.object({ id: z.literal('release_preparation'), role: z.literal('release-operator'), authority: z.literal('preview_and_pr_only'), status: z.enum(['queued', 'ready', 'completed']) }).strict(),
  z.object({ id: z.literal('growth_follow_up'), role: z.literal('growth-analyst'), authority: z.literal('aggregate_measurement_only'), status: z.enum(['queued', 'ready', 'completed']) }).strict()
]);

const completionSchema = z.object({
  runId: runIdSchema,
  runSha256: sha256Schema,
  articleSlug: slugSchema,
  articleSha256: sha256Schema,
  socialPackId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-launch$/),
  socialPackSha256: sha256Schema,
  reviewReceiptPath: z.string().regex(/^research\/reviews\/[a-z0-9-]+\.qa\.v1\.json$/),
  reviewReceiptSha256: sha256Schema,
  publicationReadiness: z.enum(['founder_review_required', 'automatic_merge_eligible']),
  nextGate: z.string().min(30)
}).strict();

export const researchMissionSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  missionId: missionIdSchema,
  status: z.enum(['started', 'completed']),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  trigger: z.object({
    type: z.literal('approved_strategy_dispatch'),
    workflow: z.literal('research-agent.yml'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    workflowRunAttempt: z.number().int().positive(),
    actor: z.string().regex(/^[A-Za-z0-9-]+(?:\[bot\])?$/),
    baseSha: gitShaSchema
  }).strict(),
  idea: z.object({
    id: z.string().regex(/^founder-idea-\d{3}$/),
    revision: z.number().int().positive(),
    sha256: sha256Schema,
    title: z.string().min(12),
    thesisType: z.enum(['recipient_friction', 'story_pairing', 'ritual_pairing', 'growth_distribution'])
  }).strict(),
  teamStages: z.array(missionStageSchema).length(4),
  deliverables: z.object({
    researchRuns: z.literal(1),
    articles: z.literal(1),
    socialLaunchPacks: z.literal(1),
    independentReviewReceipts: z.literal(1)
  }).strict(),
  qualityGates: z.object({
    minimumResearchPasses: z.literal(3),
    minimumSourceClasses: z.literal(5),
    minimumFinalists: z.literal(5),
    minimumEditorialScore: z.literal(75),
    minimumEvidenceConfidence: z.literal(70),
    minimumThoughtfulnessScore: z.literal(15),
    minimumPairCoherenceScore: z.number().int().min(80).max(100),
    independentReviewerRequired: z.literal(true),
    affiliatePosture: z.literal('enabled_registry_only')
  }).strict(),
  publicationPolicySnapshot: z.object({
    mode: z.enum(['founder_reviewed', 'automatic_after_proven']),
    automaticPromotionEnabled: z.boolean(),
    verifiedSuccessfulReleaseCount: z.number().int().nonnegative(),
    minimumSuccessfulFounderReviewedReleases: z.number().int().positive()
  }).strict(),
  completion: completionSchema.nullable()
}).strict();

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalIdeaSha256(idea) {
  return sha256(`${JSON.stringify(canonicalize(idea))}\n`);
}

function artifactDigest(record) {
  return record?.raw == null ? null : sha256(record.raw);
}

export function validateResearchMissionRecords({
  records,
  strategy,
  publicationPolicy,
  runsById = new Map(),
  articlesBySlug = new Map(),
  socialByRunId = new Map(),
  reviewsByPath = new Map()
}) {
  const issues = [];
  const missionIds = new Set();
  const activeIdeas = new Set();
  const parsedRecords = [];
  const ideasById = new Map(strategy.ideas.map((idea) => [idea.id, idea]));
  const expectedStageOrder = ['research', 'quality_review', 'release_preparation', 'growth_follow_up'];

  for (const record of records) {
    const parsed = researchMissionSchema.safeParse(record.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) issues.push(`${record.filename} ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    const mission = parsed.data;
    parsedRecords.push({ ...record, data: mission });
    if (record.filename !== `${mission.missionId}.json`) issues.push(`${mission.missionId}: filename must match missionId`);
    if (missionIds.has(mission.missionId)) issues.push(`${mission.missionId}: duplicate mission ID`);
    missionIds.add(mission.missionId);
    if (mission.missionId !== `research-mission-${mission.trigger.workflowRunId}-${mission.trigger.workflowRunAttempt}`) issues.push(`${mission.missionId}: mission ID must match workflow run and attempt`);
    if (mission.teamStages.map((stage) => stage.id).join(',') !== expectedStageOrder.join(',')) issues.push(`${mission.missionId}: team stages must use the canonical order`);

    const idea = ideasById.get(mission.idea.id);
    if (!idea) issues.push(`${mission.missionId}: strategy idea is missing`);
    else {
      if (idea.founderDisposition !== 'approved_for_research') issues.push(`${mission.missionId}: strategy idea is not founder-approved for research`);
      if (idea.revision !== mission.idea.revision) issues.push(`${mission.missionId}: idea revision mismatch`);
      if (canonicalIdeaSha256(idea) !== mission.idea.sha256) issues.push(`${mission.missionId}: idea digest mismatch`);
      if (idea.title !== mission.idea.title || idea.thesisType !== mission.idea.thesisType) issues.push(`${mission.missionId}: idea identity snapshot mismatch`);
    }
    if (mission.qualityGates.minimumPairCoherenceScore !== strategy.thoughtfulnessFramework.minimumPairCoherenceScore) issues.push(`${mission.missionId}: pair threshold differs from strategy`);

    if (mission.status === 'started') {
      if (activeIdeas.has(mission.idea.id)) issues.push(`${mission.missionId}: another active mission already exists for this idea`);
      activeIdeas.add(mission.idea.id);
      if (mission.completedAt !== null || mission.completion !== null) issues.push(`${mission.missionId}: started mission cannot contain completion evidence`);
      const statuses = Object.fromEntries(mission.teamStages.map((stage) => [stage.id, stage.status]));
      if (statuses.research !== 'in_progress' || statuses.quality_review !== 'queued' || statuses.release_preparation !== 'queued' || statuses.growth_follow_up !== 'queued') issues.push(`${mission.missionId}: started mission stage statuses are invalid`);
      const snapshot = mission.publicationPolicySnapshot;
      if (snapshot.mode !== publicationPolicy.mode || snapshot.automaticPromotionEnabled !== publicationPolicy.automaticPromotion.enabled || snapshot.verifiedSuccessfulReleaseCount !== publicationPolicy.automaticPromotion.verifiedSuccessfulReleaseCount || snapshot.minimumSuccessfulFounderReviewedReleases !== publicationPolicy.automaticPromotion.minimumSuccessfulFounderReviewedReleases) issues.push(`${mission.missionId}: active mission publication policy snapshot is stale`);
      continue;
    }

    if (mission.completedAt === null || mission.completion === null) {
      issues.push(`${mission.missionId}: completed mission needs completion evidence`);
      continue;
    }
    if (new Date(mission.completedAt) < new Date(mission.createdAt)) issues.push(`${mission.missionId}: completion precedes creation`);
    const statuses = Object.fromEntries(mission.teamStages.map((stage) => [stage.id, stage.status]));
    if (statuses.research !== 'completed' || statuses.quality_review !== 'completed' || statuses.release_preparation !== 'ready' || statuses.growth_follow_up !== 'queued') issues.push(`${mission.missionId}: completed mission stage statuses are invalid`);

    const completion = mission.completion;
    const runRecord = runsById.get(completion.runId);
    if (!runRecord) issues.push(`${mission.missionId}: completed research run is missing`);
    else {
      if (artifactDigest(runRecord) !== completion.runSha256) issues.push(`${mission.missionId}: research run digest mismatch`);
      if (runRecord.data.status !== 'validated') issues.push(`${mission.missionId}: completed research run is not validated`);
      if (runRecord.data.ideaId !== mission.idea.id || runRecord.data.ideaRevision !== mission.idea.revision || runRecord.data.ideaSha256 !== mission.idea.sha256) issues.push(`${mission.missionId}: research run is not bound to the mission idea`);
      if (runRecord.data.article.slug !== completion.articleSlug) issues.push(`${mission.missionId}: article slug differs from the research run`);
      if (runRecord.data.qa.receiptPath !== completion.reviewReceiptPath) issues.push(`${mission.missionId}: review path differs from the research run`);
    }
    const articleRecord = articlesBySlug.get(completion.articleSlug);
    if (!articleRecord) issues.push(`${mission.missionId}: completed article is missing`);
    else if (artifactDigest(articleRecord) !== completion.articleSha256) issues.push(`${mission.missionId}: article digest mismatch`);
    const socialRecord = socialByRunId.get(completion.runId);
    if (!socialRecord) issues.push(`${mission.missionId}: completed social launch pack is missing`);
    else {
      if (socialRecord.data.packId !== completion.socialPackId) issues.push(`${mission.missionId}: social pack ID mismatch`);
      if (artifactDigest(socialRecord) !== completion.socialPackSha256) issues.push(`${mission.missionId}: social pack digest mismatch`);
    }
    const reviewRecord = reviewsByPath.get(completion.reviewReceiptPath);
    if (!reviewRecord) issues.push(`${mission.missionId}: independent review receipt is missing`);
    else {
      if (artifactDigest(reviewRecord) !== completion.reviewReceiptSha256) issues.push(`${mission.missionId}: review receipt digest mismatch`);
      if (reviewRecord.data.verdict !== 'passed' || reviewRecord.data.blockers.length > 0) issues.push(`${mission.missionId}: independent review did not pass cleanly`);
      if (reviewRecord.data.workflowRunId !== mission.trigger.workflowRunId) issues.push(`${mission.missionId}: review receipt workflow run mismatch`);
    }
    const expectedReadiness = mission.publicationPolicySnapshot.automaticPromotionEnabled ? 'automatic_merge_eligible' : 'founder_review_required';
    if (completion.publicationReadiness !== expectedReadiness) issues.push(`${mission.missionId}: publication readiness differs from the mission policy snapshot`);
  }

  return { issues, missions: parsedRecords.map((record) => record.data) };
}
