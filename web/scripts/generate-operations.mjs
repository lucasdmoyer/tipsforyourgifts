import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { buildFounderAgenda } from './lib/founder-agenda-contract.mjs';
import { loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';

const root = process.cwd();
const runsDir = path.join(root, 'research', 'runs');
const missionsDir = path.join(root, 'research', 'missions');
const opportunityMissionsDir = path.join(root, 'research', 'opportunity-missions');
const opportunityReportsDir = path.join(root, 'research', 'opportunities');
const opportunityReviewsDir = path.join(root, 'research', 'opportunity-reviews');
const blogDir = path.join(root, 'src', 'data', 'blog');
const socialDir = path.join(root, 'social', 'drafts');
const socialApprovalDir = path.join(root, 'social', 'approvals');
const socialCandidateDir = path.join(root, 'social', 'candidates');
const socialAssetDir = path.join(root, 'social', 'assets');
const socialPublicationDir = path.join(root, 'social', 'publications');
const strategyPath = path.join(root, 'src', 'data', 'strategy.json');
const growthPath = path.join(root, 'src', 'data', 'growth.json');
const affiliatePath = path.join(root, 'config', 'affiliate-programs.json');
const socialChannelsPath = path.join(root, 'config', 'social-channels.json');
const livePublicationPath = path.join(root, 'config', 'live-publication.json');
const publicationPolicyPath = path.join(root, 'config', 'publication-policy.json');
const opportunityPolicyPath = path.join(root, 'config', 'opportunity-scout-policy.json');
const publicationManifestPath = path.join(root, 'public', 'publication-manifest.json');
const outputPath = path.join(root, 'src', 'data', 'operations.json');

const runNames = (await fs.readdir(runsDir)).filter((name) => name.endsWith('.json'));
const runs = await Promise.all(runNames.map(async (name) => JSON.parse(await fs.readFile(path.join(runsDir, name), 'utf8'))));
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md'));
const articles = await Promise.all(articleNames.map(async (name) => matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data));
const socialNames = (await fs.readdir(socialDir)).filter((name) => name.endsWith('.json'));
const socialPacks = await Promise.all(socialNames.map(async (name) => {
  const raw = await fs.readFile(path.join(socialDir, name));
  return { ...JSON.parse(raw), sha256: createHash('sha256').update(raw).digest('hex') };
}));
let socialApprovalNames = [];
try { socialApprovalNames = (await fs.readdir(socialApprovalDir)).filter((name) => name.endsWith('.json')); } catch {}
const socialApprovals = await Promise.all(socialApprovalNames.map(async (name) => JSON.parse(await fs.readFile(path.join(socialApprovalDir, name), 'utf8'))));
const approvalByPost = new Map(socialApprovals.map((approval) => [approval.postId, approval]));
async function loadHashedJsonRecords(directory) {
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch {}
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    return { ...JSON.parse(raw), sha256: createHash('sha256').update(raw).digest('hex') };
  }));
}
const socialAssets = await loadHashedJsonRecords(socialAssetDir);
const socialPublications = await loadHashedJsonRecords(socialPublicationDir);
const socialCandidates = await loadHashedJsonRecords(socialCandidateDir);
const researchMissions = await loadHashedJsonRecords(missionsDir);
const opportunityMissions = await loadHashedJsonRecords(opportunityMissionsDir);
const opportunityReports = await loadHashedJsonRecords(opportunityReportsDir);
const opportunityReviews = await loadHashedJsonRecords(opportunityReviewsDir);
const assetByPost = new Map(socialAssets.map((asset) => [asset.postId, asset]));
const publicationByPost = new Map(socialPublications.map((publication) => [publication.postId, publication]));
const candidateByPost = new Map();
for (const candidate of [...socialCandidates].sort((left, right) => left.generatedAt.localeCompare(right.generatedAt))) candidateByPost.set(candidate.postId, candidate);
const socialPosts = socialPacks.flatMap((pack) => (pack.posts ?? []).map((post) => ({
  ...post,
  packId: pack.packId,
  packSha256: pack.sha256,
  articleSlug: pack.articleSlug
})));
const strategy = JSON.parse(await fs.readFile(strategyPath, 'utf8'));
const growthRaw = await fs.readFile(growthPath);
const growth = JSON.parse(growthRaw.toString('utf8'));
const growthSha256 = createHash('sha256').update(growthRaw).digest('hex');
const affiliate = JSON.parse(await fs.readFile(affiliatePath, 'utf8'));
const affiliateLinkState = await loadAffiliateLinkState(root);
const socialChannelsRaw = await fs.readFile(socialChannelsPath);
const socialChannels = JSON.parse(socialChannelsRaw.toString('utf8'));
const socialChannelsSha256 = createHash('sha256').update(socialChannelsRaw).digest('hex');
const livePublication = JSON.parse(await fs.readFile(livePublicationPath, 'utf8'));
const publicationPolicy = JSON.parse(await fs.readFile(publicationPolicyPath, 'utf8'));
const opportunityPolicy = JSON.parse(await fs.readFile(opportunityPolicyPath, 'utf8'));
const publicationManifest = JSON.parse(await fs.readFile(publicationManifestPath, 'utf8'));

const validatedRuns = runs.filter((run) => run.status === 'validated').length;
const publicationReadyPosts = articles.filter((article) => article.status === 'publication_ready').length;
const draftPosts = articles.filter((article) => article.status === 'draft').length;
const affiliateProgramsEnabled = affiliate.programs.filter((program) => program.enabled).length;
const affiliateProgramsProposed = affiliate.programs.filter((program) => program.status === 'proposed').length;
const affiliateProgramsFounderApproved = affiliate.programs.filter((program) => program.status === 'founder_approved').length;
const affiliateLinksLive = affiliateLinkState.counts.activeOverlays;
const affiliateReviewByCandidate = new Map(affiliateLinkState.reviews.map((record) => [record.data.candidateId, record]));
const affiliateApprovalByCandidate = new Map(affiliateLinkState.approvals.map((record) => [record.data.candidateId, record]));
const affiliateLinkQueue = affiliateLinkState.candidates.map((record) => {
  const review = affiliateReviewByCandidate.get(record.data.candidateId);
  const approval = affiliateApprovalByCandidate.get(record.data.candidateId);
  const stage = approval ? 'approved_overlay' : review?.data.verdict === 'passed' ? 'founder_approval_required' : review?.data.verdict === 'failed' ? 'review_failed' : 'independent_review_required';
  return {
    candidateId: record.data.candidateId,
    candidateRevision: record.data.candidateRevision,
    candidatePath: record.path,
    candidateSha256: record.sha256,
    articleSlug: record.data.articleSlug,
    productId: record.data.productId,
    programId: record.data.programId,
    programRevision: record.data.programRevision,
    destinationHostname: record.data.destination.hostname,
    createdAt: record.data.createdAt,
    createdBy: record.data.createdBy,
    stage,
    reviewVerdict: review?.data.verdict ?? null,
    reviewPath: review?.path ?? null,
    reviewSha256: review?.sha256 ?? null,
    reviewedAt: review?.data.reviewedAt ?? null,
    approvalPath: approval?.path ?? null,
    approvalSha256: approval?.sha256 ?? null,
    approvedAt: approval?.data.approvedAt ?? null,
    nextGate: approval
      ? 'Include this exact approved overlay in a Firebase preview, verify disclosure and sponsored rel, then use the separate exact-SHA release gate.'
      : review?.data.verdict === 'passed'
        ? 'Lucas reviews the exact candidate and independent review hashes, then issues one action-time approval receipt.'
        : review?.data.verdict === 'failed'
          ? 'Do not approve. Correct the destination or evidence and record a new incremented candidate revision.'
          : 'Run the isolated affiliate evidence editor against this exact candidate SHA-256.'
  };
});
const socialPublished = socialPublications.length;
const socialApproved = socialApprovals.filter((approval) => approval.status === 'approved' && !publicationByPost.has(approval.postId)).length;
const socialDrafts = socialPosts.length - socialApprovals.length;
const configuredSocialChannels = socialChannels.channels.filter((channel) => ['configured', 'active'].includes(channel.status)).length;
const activeSocialChannels = socialChannels.channels.filter((channel) => channel.status === 'active').length;
const socialPublishReady = socialApprovals.filter((approval) => {
  const channel = socialChannels.channels.find((entry) => entry.id === approval.platform);
  return assetByPost.has(approval.postId) && !publicationByPost.has(approval.postId) && channel?.status === 'active' && channel.publishingEnabled;
}).length;
const approvedIdeas = strategy.ideas.filter((idea) => idea.founderDisposition === 'approved_for_research').length;
const proposedIdeas = strategy.ideas.filter((idea) => idea.founderDisposition === 'proposed').length;
const opportunityCapacityRemaining = Math.max(0, opportunityPolicy.maxOpenProposals - proposedIdeas);
const activeOpportunityMissions = opportunityMissions.filter((mission) => mission.status === 'started').length;
const completedOpportunityMissions = opportunityMissions.filter((mission) => mission.status === 'completed').length;
const opportunityPosture = !opportunityPolicy.enabled
  ? 'policy_disabled'
  : proposedIdeas >= opportunityPolicy.maxOpenProposals
    ? 'founder_backlog_full'
    : activeOpportunityMissions > 0
      ? 'scout_active'
      : 'capacity_available';
const pairingIdeas = strategy.ideas.filter((idea) => ['story_pairing', 'ritual_pairing'].includes(idea.thesisType)).length;
const recipientFrictionIdeas = strategy.ideas.filter((idea) => idea.thesisType === 'recipient_friction').length;
const latestMissionByIdea = new Map();
for (const mission of [...researchMissions].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) latestMissionByIdea.set(mission.idea.id, mission);
const activeResearchMissions = researchMissions.filter((mission) => mission.status === 'started').length;
const completedResearchMissions = researchMissions.filter((mission) => mission.status === 'completed').length;
const ideaStages = strategy.ideas.map((idea) => {
  const ideaRuns = runs.filter((run) => run.ideaId === idea.id);
  const latestRun = [...ideaRuns].sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))[0];
  const latestMission = latestMissionByIdea.get(idea.id);
  const article = latestRun ? articles.find((entry) => entry.researchRun === latestRun.runId) : undefined;
  if (idea.ideaType === 'growth' && socialDrafts > 0 && socialApproved === 0) {
    return { ideaId: idea.id, stage: 'blocked_on_account', nextGate: 'Approve the owned social account, original asset rights, cadence, and official API access.' };
  }
  if (latestMission?.status === 'started') {
    return { ideaId: idea.id, stage: 'research_mission_active', nextGate: 'Let the isolated research and independent QA jobs finish; the mission receipt will expose exact artifact hashes and release readiness.' };
  }
  if (latestRun?.status === 'validated' && article?.status === 'publication_ready') {
    return { ideaId: idea.id, stage: 'publication_ready', nextGate: 'Review the exact-SHA pull request and Firebase preview before production release.' };
  }
  if (['drafted', 'qa_failed'].includes(latestRun?.status)) {
    return { ideaId: idea.id, stage: 'independent_review', nextGate: 'Resolve evidence or editorial blockers and obtain a hash-bound independent review receipt.' };
  }
  if (latestRun?.status === 'researching') {
    return { ideaId: idea.id, stage: 'researching', nextGate: 'Complete the claim ledger, candidate field, and recipient-fit analysis.' };
  }
  if (idea.founderDisposition === 'approved_for_research') {
    return { ideaId: idea.id, stage: 'approved_for_research', nextGate: 'Start the versioned research workflow using this exact idea revision.' };
  }
  return { ideaId: idea.id, stage: idea.founderDisposition, nextGate: 'Founder approves, pauses, or rejects the research thesis.' };
});
const ideaCount = ideaStages.filter((idea) => idea.stage === 'approved_for_research').length;
const configuredGrowthConnectors = growth.connectors.filter((connector) => ['configured', 'active'].includes(connector.status)).length;
const activeGrowthConnectors = growth.connectors.filter((connector) => connector.status === 'active').length;
const proposedGrowthExperiments = growth.experiments.filter((experiment) => experiment.founderDisposition === 'proposed').length;
const approvedGrowthExperiments = growth.experiments.filter((experiment) => experiment.founderDisposition === 'approved').length;
const runningGrowthExperiments = growth.experiments.filter((experiment) => experiment.status === 'running').length;
const latestGrowthSnapshot = [...growth.snapshots].sort((left, right) => right.periodEnd.localeCompare(left.periodEnd))[0];
const measurementStatus = activeGrowthConnectors === 0
  ? 'not_connected'
  : latestGrowthSnapshot ? 'measured' : 'awaiting_snapshot';

const alerts = [];
alerts.push('Production Firebase rules have not been verified from this checkout.');
if (affiliateProgramsEnabled === 0) alerts.push('No affiliate program is enabled; links must remain non-affiliate.');
if (affiliateProgramsProposed > 0) alerts.push(`${affiliateProgramsProposed} affiliate program candidate${affiliateProgramsProposed === 1 ? ' awaits' : 's await'} founder review; approval does not enroll or enable tracking.`);
if (affiliateLinkState.counts.candidates > 0) alerts.push(`${affiliateLinkState.counts.candidates} exact affiliate link candidate${affiliateLinkState.counts.candidates === 1 ? '' : 's'}: ${affiliateLinkState.counts.activeOverlays} independently reviewed and founder-approved overlay${affiliateLinkState.counts.activeOverlays === 1 ? '' : 's'} active in generated content.`);
if (socialDrafts > 0) alerts.push(`${socialDrafts} social launch drafts await approved media, content approval, and official API access.`);
if (socialCandidates.length > 0) alerts.push(`${socialCandidates.length} original social creative candidate${socialCandidates.length === 1 ? ' is' : 's are'} locally verified but not rights-approved, released, or published.`);
else alerts.push('Social publishing is draft-only until official accounts and APIs are approved.');
if (measurementStatus === 'not_connected') alerts.push('Growth measurement is not connected; traffic, conversions, and revenue remain unknown rather than zero.');
if (proposedGrowthExperiments > 0) alerts.push(`${proposedGrowthExperiments} growth experiment${proposedGrowthExperiments === 1 ? '' : 's'} await founder review and an aggregate baseline.`);
if (proposedIdeas > 0) alerts.push(`${proposedIdeas} strategy proposal${proposedIdeas === 1 ? ' awaits' : 's await'} a founder approval decision before research can start.`);
if (opportunityPosture === 'founder_backlog_full') alerts.push(`Autonomous opportunity scouting is paused at the ${proposedIdeas}/${opportunityPolicy.maxOpenProposals} founder proposal cap; no model call is made until a proposal is resolved.`);
if (activeOpportunityMissions > 0) alerts.push(`${activeOpportunityMissions} autonomous opportunity scout mission${activeOpportunityMissions === 1 ? ' is' : 's are'} awaiting a drafted report or independent review.`);
if (!publicationPolicy.automaticPromotion.enabled) {
  alerts.push(`Production promotion remains founder-reviewed; automatic release requires ${publicationPolicy.automaticPromotion.minimumSuccessfulFounderReviewedReleases} verified successful releases and a separate founder approval.`);
}
if (ideaCount > 0) alerts.push(`${ideaCount} founder-approved thoughtful-gift idea${ideaCount === 1 ? ' is' : 's are'} ready to start through the research workflow.`);
if (activeResearchMissions > 0) alerts.push(`${activeResearchMissions} research mission${activeResearchMissions === 1 ? ' is' : 's are'} active; do not start another mission for the same idea.`);
if (completedResearchMissions > 0) alerts.push(`${completedResearchMissions} research mission${completedResearchMissions === 1 ? ' has' : 's have'} a hash-bound completion receipt and release handoff.`);

const sourceDates = [
  strategy.updatedAt,
  growth.updatedAt,
  affiliate.updatedAt,
  socialChannels.updatedAt,
  publicationPolicy.updatedAt,
  opportunityPolicy.updatedAt,
  publicationManifest.generatedAt,
  livePublication.updatedAt,
  ...runs.map((run) => run.completedAt ?? run.startedAt).filter(Boolean),
  ...researchMissions.flatMap((mission) => [mission.createdAt, mission.completedAt]).filter(Boolean),
  ...opportunityMissions.flatMap((mission) => [mission.createdAt, mission.completedAt]).filter(Boolean),
  ...opportunityReports.map((report) => report.createdAt),
  ...opportunityReviews.map((review) => review.reviewedAt),
  ...growth.snapshots.map((snapshot) => snapshot.collectedAt),
  ...socialApprovals.map((approval) => approval.approvedAt),
  ...socialCandidates.map((candidate) => candidate.generatedAt),
  ...socialAssets.map((asset) => asset.approvedAt),
  ...socialPublications.map((publication) => publication.publishedAt),
  ...affiliateLinkState.candidates.map((record) => record.data.createdAt),
  ...affiliateLinkState.reviews.map((record) => record.data.reviewedAt),
  ...affiliateLinkState.approvals.map((record) => record.data.approvedAt),
  ...articles.flatMap((article) => [article.publishDate, article.updatedDate]).filter(Boolean)
].map((value) => new Date(value).valueOf()).filter(Number.isFinite);
const generatedAt = new Date(Math.max(...sourceDates)).toISOString();
const founderAgenda = buildFounderAgenda({
  generatedAt,
  strategy,
  affiliate,
  socialChannels,
  publicationPolicy,
  publicationManifest,
  livePublication,
  growth,
  openStrategyProposals: proposedIdeas,
  maxOpenStrategyProposals: opportunityPolicy.maxOpenProposals,
  socialDraftCount: socialPosts.length,
  socialCreativeCandidateCount: socialCandidates.length,
  socialChannelsSha256,
  growthSha256,
  affiliateLinks: {
    candidates: affiliateLinkState.counts.candidates,
    passedReviews: affiliateLinkState.counts.passedReviews,
    approvals: affiliateLinkState.counts.approvals,
    activeOverlays: affiliateLinkState.counts.activeOverlays,
    queue: affiliateLinkQueue
  }
});

const operations = {
  generatedAt,
  founderAgenda,
  researchRuns: runs.length,
  validatedRuns,
  publicationReadyPosts,
  draftPosts,
  affiliateProgramsEnabled,
  affiliateProgramsProposed,
  affiliateProgramsFounderApproved,
  affiliateLinksLive,
  socialDrafts,
  socialApproved,
  socialPublished,
  approvedIdeas,
  proposedIdeas,
  pairingIdeas,
  recipientFrictionIdeas,
  researchMissions: {
    total: researchMissions.length,
    active: activeResearchMissions,
    completed: completedResearchMissions,
    founderReviewRequired: researchMissions.filter((mission) => mission.completion?.publicationReadiness === 'founder_review_required').length,
    automaticMergeEligible: researchMissions.filter((mission) => mission.completion?.publicationReadiness === 'automatic_merge_eligible').length,
    queue: [...researchMissions].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((mission) => ({
      missionId: mission.missionId,
      recordSha256: mission.sha256,
      status: mission.status,
      ideaId: mission.idea.id,
      ideaTitle: mission.idea.title,
      ideaRevision: mission.idea.revision,
      ideaSha256: mission.idea.sha256,
      createdAt: mission.createdAt,
      completedAt: mission.completedAt,
      workflowRunId: mission.trigger.workflowRunId,
      activeStage: mission.teamStages.find((stage) => ['in_progress', 'ready'].includes(stage.status))?.id ?? 'growth_follow_up',
      runId: mission.completion?.runId ?? null,
      articleSlug: mission.completion?.articleSlug ?? null,
      publicationReadiness: mission.completion?.publicationReadiness ?? 'research_in_progress',
      nextGate: mission.completion?.nextGate ?? 'Complete the evidence bundle, independent QA receipt, deterministic gates, and mission completion receipt.'
    }))
  },
  opportunityScouting: {
    enabled: opportunityPolicy.enabled,
    cadence: opportunityPolicy.cadence,
    posture: opportunityPosture,
    maxOpenProposals: opportunityPolicy.maxOpenProposals,
    openProposals: proposedIdeas,
    capacityRemaining: opportunityCapacityRemaining,
    totalMissions: opportunityMissions.length,
    activeMissions: activeOpportunityMissions,
    completedMissions: completedOpportunityMissions,
    draftedReports: opportunityReports.filter((report) => report.status === 'drafted').length,
    validatedReports: opportunityReports.filter((report) => report.status === 'validated').length,
    passedReviews: opportunityReviews.filter((review) => review.verdict === 'passed').length,
    policy: {
      minimumResearchPasses: opportunityPolicy.minimumResearchPasses,
      minimumSources: opportunityPolicy.minimumSources,
      minimumSourceClasses: opportunityPolicy.minimumSourceClasses,
      minimumPublicSocialOrCommunitySources: opportunityPolicy.minimumPublicSocialOrCommunitySources,
      minimumCandidates: opportunityPolicy.minimumCandidates,
      maximumCandidates: opportunityPolicy.maximumCandidates,
      minimumSignals: opportunityPolicy.minimumSignals,
      minimumEvidenceConfidence: opportunityPolicy.minimumEvidenceConfidence,
      minimumThoughtfulnessPotential: opportunityPolicy.minimumThoughtfulnessPotential,
      diminishingReturnThreshold: opportunityPolicy.diminishingReturnThreshold,
      socialEvidencePolicy: opportunityPolicy.socialEvidencePolicy
    },
    queue: [...opportunityMissions].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((mission) => {
      const report = opportunityReports.find((candidate) => candidate.scoutId === mission.missionId);
      const review = opportunityReviews.find((candidate) => candidate.scoutId === mission.missionId);
      const selectedCandidate = report?.candidates?.find((candidate) => candidate.id === report.selectedProposal.candidateId);
      return {
        scoutId: mission.missionId,
        missionRecordSha256: mission.sha256,
        reportRecordSha256: report?.sha256 ?? null,
        status: report?.status ?? mission.status,
        createdAt: mission.createdAt,
        completedAt: mission.completedAt,
        expectedProposalId: mission.expectedProposalId,
        selectedProposalId: report?.selectedProposal.proposalId ?? null,
        selectedTitle: report?.selectedProposal.title ?? null,
        candidates: report?.candidates.length ?? 0,
        sources: report?.sources.length ?? 0,
        sourceClasses: report ? new Set(report.sources.map((source) => source.sourceClass)).size : 0,
        publicSocialOrCommunitySources: report?.sources.filter((source) => ['public_social', 'public_community'].includes(source.sourceClass)).length ?? 0,
        evidenceConfidence: selectedCandidate?.score.evidenceConfidence ?? null,
        thoughtfulnessPotential: selectedCandidate?.score.thoughtfulnessPotential ?? null,
        reviewVerdict: review?.verdict ?? null,
        nextGate: report?.status === 'validated'
          ? 'Founder reviews the proposal; approval is a separate exact-revision workflow.'
          : report
            ? 'Independent opportunity editor must issue a hash-bound clean review receipt.'
            : 'Opportunity research desk must draft one policy-compliant report and one proposed strategy idea.'
      };
    })
  },
  affiliate: {
    proposedPrograms: affiliateProgramsProposed,
    founderApprovedPrograms: affiliateProgramsFounderApproved,
    enabledPrograms: affiliateProgramsEnabled,
    linkCandidates: affiliateLinkState.counts.candidates,
    linkReviewsPassed: affiliateLinkState.counts.passedReviews,
    linkApprovals: affiliateLinkState.counts.approvals,
    activeOverlays: affiliateLinkState.counts.activeOverlays,
    approvedOverlaySetSha256: publicationManifest.affiliatePosture.approvedOverlaySetSha256,
    linkQueue: affiliateLinkQueue,
    programs: affiliate.programs.map((program) => ({
      id: program.id,
      revision: program.revision,
      name: program.name,
      status: program.status,
      founderDisposition: program.founderDisposition,
      eligibleArticleSlugs: program.eligibleArticleSlugs,
      editorialFit: program.editorialFit,
      limitations: program.limitations,
      sourceCheckedAt: program.sourceCheckedAt,
      sourceReviewExpiresAt: program.sourceReviewExpiresAt,
      programHomepageUrl: program.programHomepageUrl,
      termsUrl: program.termsUrl,
      nextGate: program.nextGate
    }))
  },
  social: {
    officialApiOnly: socialChannels.policy.officialApiOnly,
    configSha256: socialChannelsSha256,
    channelsTotal: socialChannels.channels.length,
    channelsConfigured: configuredSocialChannels,
    channelsActive: activeSocialChannels,
    creativeCandidates: socialCandidates.length,
    mediaAssetsApproved: socialAssets.length,
    approvalReceipts: socialApprovals.length,
    publicationReceipts: socialPublications.length,
    publishReady: socialPublishReady,
    channels: socialChannels.channels.map((channel) => ({
      id: channel.id,
      priority: channel.priority,
      status: channel.status,
      founderApproved: channel.founderApproved,
      publishingEnabled: channel.publishingEnabled,
      publisher: channel.publisher,
      configurationEvidenceUrl: channel.configurationEvidenceUrl,
      configuredAt: channel.configuredAt,
      activatedAt: channel.activatedAt,
      maxPostsPerWeek: channel.maxPostsPerWeek,
      nextGate: channel.nextGate
    })),
    queue: socialPosts.map((post) => ({
      postId: post.id,
      packId: post.packId,
      packSha256: post.packSha256,
      articleSlug: post.articleSlug,
      platform: post.platform,
      format: post.format,
      headline: post.headline,
      angle: post.angle,
      status: publicationByPost.has(post.id) ? 'published' : approvalByPost.has(post.id) ? 'approved' : assetByPost.has(post.id) ? 'media_approved' : candidateByPost.has(post.id) ? 'creative_candidate' : 'draft',
      creativeCandidateId: candidateByPost.get(post.id)?.candidateId ?? null,
      creativeCandidateRecordSha256: candidateByPost.get(post.id)?.sha256 ?? null,
      creativeCandidateAssetPath: candidateByPost.get(post.id)?.assetPath ?? null,
      creativeCandidateContentSha256: candidateByPost.get(post.id)?.contentSha256 ?? null,
      creativeCandidateGeneratedAt: candidateByPost.get(post.id)?.generatedAt ?? null,
      creativeCandidateRightsPosture: candidateByPost.get(post.id)?.rightsPosture ?? null,
      creativeCandidateAltText: candidateByPost.get(post.id)?.altText ?? null,
      mediaAssetId: assetByPost.get(post.id)?.mediaAssetId ?? null,
      mediaAssetRecordSha256: assetByPost.get(post.id)?.sha256 ?? null,
      approvalId: approvalByPost.get(post.id)?.approvalId ?? null,
      externalPostId: publicationByPost.get(post.id)?.externalPostId ?? null,
      externalPostUrl: publicationByPost.get(post.id)?.externalPostUrl ?? null,
      publicationReceiptId: publicationByPost.get(post.id)?.publicationId ?? null,
      publishReadiness: publicationByPost.has(post.id)
        ? 'published'
        : !candidateByPost.has(post.id)
          ? 'blocked_creative'
          : !assetByPost.has(post.id)
            ? 'blocked_media_approval'
          : !approvalByPost.has(post.id)
            ? 'blocked_content_approval'
            : socialChannels.channels.find((channel) => channel.id === post.platform)?.status !== 'active'
              ? 'blocked_channel'
              : 'ready_for_official_api',
      claimCount: post.claimIds?.length ?? 0,
      productCount: post.productIds?.length ?? 0,
      pairCount: post.pairIds?.length ?? 0,
      destinationUrl: post.destinationUrl,
      nextGate: publicationByPost.has(post.id)
        ? 'Import an official aggregate reporting snapshot before evaluating performance.'
        : !candidateByPost.has(post.id)
          ? 'Generate an original rights-controlled creative bound to this exact post and pack.'
          : !assetByPost.has(post.id)
            ? 'Review the exact creative in a Firebase preview, release its stable owned URL, then record founder media-rights approval.'
          : !approvalByPost.has(post.id)
            ? 'Approve the exact copy, destination, disclosure, and media record.'
            : 'Publish only through the protected official API workflow after the channel is active.'
    }))
  },
  publication: {
    mode: publicationPolicy.mode,
    automaticPromotionEnabled: publicationPolicy.automaticPromotion.enabled,
    verifiedSuccessfulReleaseCount: publicationPolicy.automaticPromotion.verifiedSuccessfulReleaseCount,
    minimumSuccessfulFounderReviewedReleases: publicationPolicy.automaticPromotion.minimumSuccessfulFounderReviewedReleases,
    verifiedReleaseReceiptRequired: publicationPolicy.requiredGates.verifiedReleaseReceipt,
    receiptRetentionDays: 90,
    releaseEvidenceSource: 'github_production_deployments_at_enable_time',
    currentLive: {
      status: livePublication.status,
      updatedAt: livePublication.updatedAt,
      receiptId: livePublication.latestVerifiedContentRelease?.receiptId ?? null,
      receiptSha256: livePublication.latestVerifiedContentRelease?.receiptSha256 ?? null,
      receiptPath: livePublication.latestVerifiedContentRelease?.receiptPath ?? null,
      releaseSha: livePublication.latestVerifiedContentRelease?.releaseSha ?? null,
      workflowRunUrl: livePublication.latestVerifiedContentRelease?.workflowRunUrl ?? null,
      manifestId: livePublication.latestVerifiedContentRelease?.publicationManifest.manifestId ?? null,
      contentSetSha256: livePublication.latestVerifiedContentRelease?.publicationManifest.contentSetSha256 ?? null,
      articles: livePublication.latestVerifiedContentRelease?.publicationManifest.articles ?? 0,
      affiliateLinks: livePublication.latestVerifiedContentRelease?.publicationManifest.affiliateLinks ?? 0,
      matchesCurrentCandidate: livePublication.latestVerifiedContentRelease?.publicationManifest.contentSetSha256 === publicationManifest.contentSetSha256
    },
    currentCandidate: {
      status: publicationManifest.status,
      manifestId: publicationManifest.manifestId,
      contentSetSha256: publicationManifest.contentSetSha256,
      articles: publicationManifest.counts.articles,
      independentReviews: publicationManifest.counts.independentReviews,
      socialLaunchPacks: publicationManifest.counts.socialLaunchPacks,
      socialDrafts: publicationManifest.counts.socialDrafts,
      missionBoundArticles: publicationManifest.counts.missionBoundArticles,
      preMissionValidatedArticles: publicationManifest.counts.preMissionValidatedArticles,
      affiliateLinks: publicationManifest.counts.affiliateLinks
    }
  },
  growth: {
    configSha256: growthSha256,
    measurementStatus,
    connectorsTotal: growth.connectors.length,
    connectorsConfigured: configuredGrowthConnectors,
    connectorsActive: activeGrowthConnectors,
    snapshotCount: growth.snapshots.length,
    latestPeriodEnd: latestGrowthSnapshot?.periodEnd ?? null,
    proposedExperiments: proposedGrowthExperiments,
    approvedExperiments: approvedGrowthExperiments,
    runningExperiments: runningGrowthExperiments,
    searchConsole: (() => {
      const connector = growth.connectors.find((entry) => entry.id === 'search-console');
      return {
        status: connector.status,
        founderApproved: connector.founderApproved,
        propertyReference: connector.sourceReference,
        collectionMethod: connector.collectionMethod,
        authenticationMode: connector.authenticationMode,
        configurationEvidenceUrl: connector.configurationEvidenceUrl,
        configuredAt: connector.configuredAt,
        activatedAt: connector.activatedAt,
        snapshotImportEnabled: connector.snapshotImportEnabled,
        automatedCollectionEnabled: connector.automatedCollectionEnabled,
        nextGate: connector.nextGate
      };
    })()
  },
  ideaStages,
  pipeline: {
    idea: strategy.ideas.length,
    researching: runs.filter((run) => run.status === 'researching').length,
    missionsActive: activeResearchMissions,
    missionsCompleted: completedResearchMissions,
    opportunityScoutsActive: activeOpportunityMissions,
    opportunityReportsValidated: opportunityReports.filter((report) => report.status === 'validated').length,
    qa: runs.filter((run) => ['drafted', 'qa_failed'].includes(run.status)).length,
    proposed: proposedIdeas,
    ready: ideaCount,
    publicationReady: publicationReadyPosts,
    socialDrafts
  },
  alerts
};

await fs.writeFile(outputPath, `${JSON.stringify(operations, null, 2)}\n`);
console.log(`Generated ${path.relative(root, outputPath)}`);
