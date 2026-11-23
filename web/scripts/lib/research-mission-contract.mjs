import crypto from 'node:crypto';
import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const missionIdSchema = z.string().regex(/^research-mission-[1-9]\d*-[1-9]\d*$/);
const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const missionStageSchema = z.discriminatedUnion('id', [
  z.object({ id: z.literal('research'), role: z.literal('research-editorial-team'), authority: z.literal('draft_only'), status: z.enum(['queued', 'in_progress', 'completed', 'blocked']) }).strict(),
  z.object({ id: z.literal('quality_review'), role: z.literal('independent-evidence-editor'), authority: z.literal('review_receipt_only'), status: z.enum(['queued', 'in_progress', 'completed', 'blocked']) }).strict(),
  z.object({ id: z.literal('visual_production'), role: z.literal('visual-production-team'), authority: z.literal('original_assets_and_visual_receipt_only'), status: z.enum(['queued', 'in_progress', 'completed']) }).strict(),
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
  reviewReceiptPath: z.string().regex(/^research\/reviews\/[a-z0-9-]+\.qa\.v[1-9]\d*\.json$/),
  reviewReceiptSha256: sha256Schema,
  publicationReadiness: z.enum(['founder_review_required', 'automatic_merge_eligible']),
  nextGate: z.string().min(30)
}).strict();

const visualHandoffSchema = z.object({
  runId: runIdSchema,
  runSha256: sha256Schema,
  articleSlug: slugSchema,
  articleSha256: sha256Schema,
  socialPackId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-launch$/),
  socialPackSha256: sha256Schema,
  reviewReceiptPath: z.string().regex(/^research\/reviews\/[a-z0-9-]+\.qa\.v[1-9]\d*\.json$/),
  reviewReceiptSha256: sha256Schema,
  visualRequestPath: z.string().regex(/^visuals\/requests\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals\.json$/),
  visualRequestSha256: sha256Schema,
  nextGate: z.string().min(40)
}).strict();

const qaFailureHandoffSchema = z.object({
  runId: runIdSchema,
  runSha256: sha256Schema,
  articleSlug: slugSchema,
  articleSha256: sha256Schema,
  socialPackId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-launch$/),
  socialPackSha256: sha256Schema,
  reviewReceiptPath: z.string().regex(/^research\/reviews\/[a-z0-9-]+\.qa\.v[1-9]\d*\.json$/),
  reviewReceiptSha256: sha256Schema,
  reviewerId: z.string().min(3),
  reviewedAt: z.string().datetime(),
  blockers: z.array(z.string().min(12)).min(1),
  warnings: z.array(z.string().min(12)),
  nextGate: z.string().min(40)
}).strict();

const researchFailureHandoffSchema = z.object({
  reasonCode: z.enum(['model_step_failed', 'draft_bundle_invalid']),
  workflowRunUrl: z.string().url(),
  nextGate: z.string().min(40)
}).strict();

export const researchMissionSchema = z.object({
  schemaVersion: z.literal('1.3.0'),
  missionId: missionIdSchema,
  status: z.enum(['started', 'research_failed', 'qa_failed', 'visual_pending', 'completed']),
  createdAt: z.string().datetime(),
  failedAt: z.string().datetime().nullable(),
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
  teamStages: z.array(missionStageSchema).length(5),
  deliverables: z.object({
    researchRuns: z.literal(1),
    articles: z.literal(1),
    socialLaunchPacks: z.literal(1),
    independentReviewReceipts: z.literal(1),
    approvedVisualSets: z.literal(1)
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
  researchFailureHandoff: researchFailureHandoffSchema.nullable(),
  qaFailureHandoff: qaFailureHandoffSchema.nullable(),
  visualHandoff: visualHandoffSchema.nullable(),
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

export function reviewReceiptBelongsToMission(receipt, mission) {
  if (receipt?.schemaVersion === '1.2.0') {
    if (receipt.missionId !== mission.missionId) return false;
    if (receipt.workflowName === 'research-agent.yml') return receipt.workflowRunId === mission.trigger.workflowRunId;
    return receipt.workflowName === 'editorial-independent-review.yml';
  }
  return receipt?.workflowRunId === mission.trigger.workflowRunId;
}

export function validateResearchMissionRecords({
  records,
  strategy,
  publicationPolicy,
  runsById = new Map(),
  articlesBySlug = new Map(),
  socialByRunId = new Map(),
  reviewsByPath = new Map(),
  visualRequestsByPath = new Map()
}) {
  const issues = [];
  const missionIds = new Set();
  const activeIdeas = new Set();
  const parsedRecords = [];
  const ideasById = new Map(strategy.ideas.map((idea) => [idea.id, idea]));
  const expectedStageOrder = ['research', 'quality_review', 'visual_production', 'release_preparation', 'growth_follow_up'];

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
      if (mission.failedAt !== null || mission.completedAt !== null || mission.researchFailureHandoff !== null || mission.qaFailureHandoff !== null || mission.visualHandoff !== null || mission.completion !== null) issues.push(`${mission.missionId}: started mission cannot contain handoff or completion evidence`);
      const statuses = Object.fromEntries(mission.teamStages.map((stage) => [stage.id, stage.status]));
      if (statuses.research !== 'in_progress' || statuses.quality_review !== 'queued' || statuses.visual_production !== 'queued' || statuses.release_preparation !== 'queued' || statuses.growth_follow_up !== 'queued') issues.push(`${mission.missionId}: started mission stage statuses are invalid`);
      const snapshot = mission.publicationPolicySnapshot;
      if (snapshot.mode !== publicationPolicy.mode || snapshot.automaticPromotionEnabled !== publicationPolicy.automaticPromotion.enabled || snapshot.verifiedSuccessfulReleaseCount !== publicationPolicy.automaticPromotion.verifiedSuccessfulReleaseCount || snapshot.minimumSuccessfulFounderReviewedReleases !== publicationPolicy.automaticPromotion.minimumSuccessfulFounderReviewedReleases) issues.push(`${mission.missionId}: active mission publication policy snapshot is stale`);
      continue;
    }

    if (mission.status === 'research_failed') {
      if (mission.failedAt === null || mission.completedAt !== null || mission.researchFailureHandoff === null || mission.qaFailureHandoff !== null || mission.visualHandoff !== null || mission.completion !== null) {
        issues.push(`${mission.missionId}: research-failed mission needs one failure handoff and no editorial, visual, or completion evidence`);
        continue;
      }
      if (new Date(mission.failedAt) < new Date(mission.createdAt)) issues.push(`${mission.missionId}: research failure precedes mission creation`);
      const statuses = Object.fromEntries(mission.teamStages.map((stage) => [stage.id, stage.status]));
      if (statuses.research !== 'blocked' || statuses.quality_review !== 'queued' || statuses.visual_production !== 'queued' || statuses.release_preparation !== 'queued' || statuses.growth_follow_up !== 'queued') issues.push(`${mission.missionId}: research-failed mission stage statuses are invalid`);
      const expectedRunUrl = `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${mission.trigger.workflowRunId}`;
      if (mission.researchFailureHandoff.workflowRunUrl !== expectedRunUrl) issues.push(`${mission.missionId}: research failure workflow URL does not match the triggering run`);
      continue;
    }

    if (mission.status === 'qa_failed') {
      if (mission.failedAt === null || mission.completedAt !== null || mission.researchFailureHandoff !== null || mission.qaFailureHandoff === null || mission.visualHandoff !== null || mission.completion !== null) {
        issues.push(`${mission.missionId}: qa-failed mission needs one failure handoff and no visual or completion evidence`);
        continue;
      }
      if (new Date(mission.failedAt) < new Date(mission.createdAt)) issues.push(`${mission.missionId}: QA failure precedes mission creation`);
      const statuses = Object.fromEntries(mission.teamStages.map((stage) => [stage.id, stage.status]));
      if (statuses.research !== 'completed' || statuses.quality_review !== 'blocked' || statuses.visual_production !== 'queued' || statuses.release_preparation !== 'queued' || statuses.growth_follow_up !== 'queued') issues.push(`${mission.missionId}: qa-failed mission stage statuses are invalid`);
      const handoff = mission.qaFailureHandoff;
      const runRecord = runsById.get(handoff.runId);
      const articleRecord = articlesBySlug.get(handoff.articleSlug);
      const socialRecord = socialByRunId.get(handoff.runId);
      const reviewRecord = reviewsByPath.get(handoff.reviewReceiptPath);
      if (!runRecord) issues.push(`${mission.missionId}: QA failure research run is missing`);
      else {
        if (artifactDigest(runRecord) !== handoff.runSha256) issues.push(`${mission.missionId}: QA failure run digest mismatch`);
        if (!['drafted', 'qa_failed'].includes(runRecord.data.status) || runRecord.data.article?.status !== 'draft' || runRecord.data.qa?.passed !== false) issues.push(`${mission.missionId}: QA failure run must remain an unpromoted draft`);
        if (runRecord.data.ideaId !== mission.idea.id || runRecord.data.ideaRevision !== mission.idea.revision || runRecord.data.ideaSha256 !== mission.idea.sha256) issues.push(`${mission.missionId}: QA failure run is not bound to the mission idea`);
      }
      if (!articleRecord) issues.push(`${mission.missionId}: QA failure article is missing`);
      else if (artifactDigest(articleRecord) !== handoff.articleSha256) issues.push(`${mission.missionId}: QA failure article digest mismatch`);
      if (!socialRecord) issues.push(`${mission.missionId}: QA failure social pack is missing`);
      else {
        if (socialRecord.data.packId !== handoff.socialPackId) issues.push(`${mission.missionId}: QA failure social pack ID mismatch`);
        if (artifactDigest(socialRecord) !== handoff.socialPackSha256) issues.push(`${mission.missionId}: QA failure social pack digest mismatch`);
      }
      if (!reviewRecord) issues.push(`${mission.missionId}: QA failure review receipt is missing`);
      else {
        if (artifactDigest(reviewRecord) !== handoff.reviewReceiptSha256) issues.push(`${mission.missionId}: QA failure review receipt digest mismatch`);
        if (reviewRecord.data.verdict !== 'failed' || reviewRecord.data.blockers.length === 0) issues.push(`${mission.missionId}: QA failure receipt must contain a failed verdict and blockers`);
        if (!reviewReceiptBelongsToMission(reviewRecord.data, mission)) issues.push(`${mission.missionId}: QA failure review mission provenance mismatch`);
        if (reviewRecord.data.reviewerId !== handoff.reviewerId || reviewRecord.data.reviewedAt !== handoff.reviewedAt) issues.push(`${mission.missionId}: QA failure reviewer identity differs from the receipt`);
        if (JSON.stringify(reviewRecord.data.blockers) !== JSON.stringify(handoff.blockers) || JSON.stringify(reviewRecord.data.warnings) !== JSON.stringify(handoff.warnings)) issues.push(`${mission.missionId}: QA failure findings differ from the receipt`);
      }
      continue;
    }

    if (mission.status === 'visual_pending') {
      if (activeIdeas.has(mission.idea.id)) issues.push(`${mission.missionId}: another active mission already exists for this idea`);
      activeIdeas.add(mission.idea.id);
      if (mission.failedAt !== null || mission.completedAt !== null || mission.researchFailureHandoff !== null || mission.qaFailureHandoff !== null || mission.completion !== null || mission.visualHandoff === null) {
        issues.push(`${mission.missionId}: visual-pending mission needs one handoff and no completion evidence`);
        continue;
      }
      const statuses = Object.fromEntries(mission.teamStages.map((stage) => [stage.id, stage.status]));
      if (statuses.research !== 'completed' || statuses.quality_review !== 'completed' || statuses.visual_production !== 'in_progress' || statuses.release_preparation !== 'queued' || statuses.growth_follow_up !== 'queued') issues.push(`${mission.missionId}: visual-pending mission stage statuses are invalid`);
      const handoff = mission.visualHandoff;
      const runRecord = runsById.get(handoff.runId);
      const articleRecord = articlesBySlug.get(handoff.articleSlug);
      const socialRecord = socialByRunId.get(handoff.runId);
      const reviewRecord = reviewsByPath.get(handoff.reviewReceiptPath);
      const visualRequestRecord = visualRequestsByPath.get(handoff.visualRequestPath);
      if (!runRecord) issues.push(`${mission.missionId}: visual handoff research run is missing`);
      else {
        if (artifactDigest(runRecord) !== handoff.runSha256) issues.push(`${mission.missionId}: visual handoff run digest mismatch`);
        if (!['drafted', 'qa_failed'].includes(runRecord.data.status) || runRecord.data.article?.status !== 'draft') issues.push(`${mission.missionId}: visual handoff run must remain draft`);
        if (runRecord.data.ideaId !== mission.idea.id || runRecord.data.ideaRevision !== mission.idea.revision || runRecord.data.ideaSha256 !== mission.idea.sha256) issues.push(`${mission.missionId}: visual handoff run is not bound to the mission idea`);
      }
      if (!articleRecord) issues.push(`${mission.missionId}: visual handoff article is missing`);
      else if (artifactDigest(articleRecord) !== handoff.articleSha256) issues.push(`${mission.missionId}: visual handoff article digest mismatch`);
      if (!socialRecord) issues.push(`${mission.missionId}: visual handoff social pack is missing`);
      else {
        if (socialRecord.data.packId !== handoff.socialPackId) issues.push(`${mission.missionId}: visual handoff social pack ID mismatch`);
        if (artifactDigest(socialRecord) !== handoff.socialPackSha256) issues.push(`${mission.missionId}: visual handoff social pack digest mismatch`);
      }
      if (!reviewRecord) issues.push(`${mission.missionId}: visual handoff review receipt is missing`);
      else {
        if (artifactDigest(reviewRecord) !== handoff.reviewReceiptSha256) issues.push(`${mission.missionId}: visual handoff review receipt digest mismatch`);
        if (reviewRecord.data.verdict !== 'passed' || reviewRecord.data.blockers.length > 0) issues.push(`${mission.missionId}: visual handoff editorial review did not pass cleanly`);
        if (!reviewReceiptBelongsToMission(reviewRecord.data, mission)) issues.push(`${mission.missionId}: visual handoff review mission provenance mismatch`);
      }
      if (!visualRequestRecord) issues.push(`${mission.missionId}: visual handoff request is missing`);
      else {
        if (artifactDigest(visualRequestRecord) !== handoff.visualRequestSha256) issues.push(`${mission.missionId}: visual handoff request digest mismatch`);
        if (visualRequestRecord.data.runId !== handoff.runId || visualRequestRecord.data.articleSlug !== handoff.articleSlug) issues.push(`${mission.missionId}: visual handoff request identity mismatch`);
      }
      continue;
    }

    if (mission.failedAt !== null || mission.researchFailureHandoff !== null || mission.qaFailureHandoff !== null || mission.completedAt === null || mission.completion === null) {
      issues.push(`${mission.missionId}: completed mission needs completion evidence`);
      continue;
    }
    if (new Date(mission.completedAt) < new Date(mission.createdAt)) issues.push(`${mission.missionId}: completion precedes creation`);
    const statuses = Object.fromEntries(mission.teamStages.map((stage) => [stage.id, stage.status]));
    if (statuses.research !== 'completed' || statuses.quality_review !== 'completed' || statuses.visual_production !== 'completed' || statuses.release_preparation !== 'ready' || statuses.growth_follow_up !== 'queued') issues.push(`${mission.missionId}: completed mission stage statuses are invalid`);

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
      if (!reviewReceiptBelongsToMission(reviewRecord.data, mission)) issues.push(`${mission.missionId}: review receipt mission provenance mismatch`);
    }
    const expectedReadiness = mission.publicationPolicySnapshot.automaticPromotionEnabled ? 'automatic_merge_eligible' : 'founder_review_required';
    if (completion.publicationReadiness !== expectedReadiness) issues.push(`${mission.missionId}: publication readiness differs from the mission policy snapshot`);
    if (mission.visualHandoff && (mission.visualHandoff.runId !== completion.runId || mission.visualHandoff.articleSlug !== completion.articleSlug || mission.visualHandoff.reviewReceiptPath !== completion.reviewReceiptPath)) issues.push(`${mission.missionId}: completed mission differs from its visual handoff`);
  }

  return { issues, missions: parsedRecords.map((record) => record.data) };
}
