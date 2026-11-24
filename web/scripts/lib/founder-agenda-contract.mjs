import { z } from 'zod';
import { canonicalIdeaSha256 } from './research-mission-contract.mjs';
import { strategyApprovalAuthorityLines } from '../resolve-strategy-approval-request.mjs';

const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');
const searchConsoleDecisionPacketUrl = 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/59';
const pinterestDecisionPacketUrl = 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/61';
const decisionSchema = z.object({
  id: z.enum(['review-release-candidate', 'choose-next-thesis', 'establish-measurement', 'configure-first-social-channel', 'choose-affiliate-pilot']),
  rank: z.number().int().min(1).max(5),
  priorityScore: z.number().int().min(1).max(100),
  horizon: z.enum(['now', 'next', 'later']),
  category: z.enum(['release', 'editorial_direction', 'measurement', 'distribution', 'monetization']),
  title: z.string().min(12),
  recommendation: z.string().min(40),
  decisionQuestion: z.string().min(30),
  rationale: z.string().min(60),
  evidence: z.array(z.string().min(12)).min(2).max(5),
  unlocks: z.string().min(40),
  tradeoff: z.string().min(40),
  guardrail: z.string().min(40),
  reversibility: z.enum(['high', 'medium', 'low']),
  founderActionRequired: z.literal(true),
  action: z.object({
    label: z.string().min(8),
    url: httpsUrl,
    command: z.string().min(20).nullable()
  }).strict()
}).strict();

export const founderAgendaSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  generatedAt: z.string().datetime(),
  posture: z.literal('founder_decisions_required'),
  primaryDecisionId: decisionSchema.shape.id,
  profitabilityEvidence: z.literal('unknown_until_aggregate_measurement'),
  operatingPrinciple: z.literal('measure_before_scaling_and_rank_before_commission'),
  decisions: z.array(decisionSchema).min(1).max(5)
}).strict().superRefine((agenda, context) => {
  const ids = new Set();
  const categories = new Set();
  for (const [index, decision] of agenda.decisions.entries()) {
    if (decision.rank !== index + 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ['decisions', index, 'rank'], message: 'decision ranks must be sequential' });
    if (index > 0 && decision.priorityScore >= agenda.decisions[index - 1].priorityScore) context.addIssue({ code: z.ZodIssueCode.custom, path: ['decisions', index, 'priorityScore'], message: 'priority scores must be strictly descending' });
    if (ids.has(decision.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['decisions', index, 'id'], message: 'decision IDs must be unique' });
    if (categories.has(decision.category)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['decisions', index, 'category'], message: 'decision categories must be unique' });
    ids.add(decision.id);
    categories.add(decision.category);
  }
  if (agenda.primaryDecisionId !== agenda.decisions[0]?.id) context.addIssue({ code: z.ZodIssueCode.custom, path: ['primaryDecisionId'], message: 'primary decision must be the highest-ranked decision' });
});

const priorityWeight = { high: 3, medium: 2, low: 1 };

function selectStrategyCandidate(strategy) {
  return strategy.ideas
    .filter((idea) => idea.founderDisposition === 'proposed')
    .sort((left, right) => {
      const priorityDifference = (priorityWeight[right.priority] ?? 0) - (priorityWeight[left.priority] ?? 0);
      if (priorityDifference !== 0) return priorityDifference;
      const coherenceDifference = (right.pairing?.coherenceScore ?? 0) - (left.pairing?.coherenceScore ?? 0);
      if (coherenceDifference !== 0) return coherenceDifference;
      return left.id.localeCompare(right.id);
    })[0];
}

function selectAffiliatePilot(affiliate) {
  return affiliate.programs
    .filter((program) => ['proposed', 'founder_approved', 'externally_verified'].includes(program.status))
    .sort((left, right) => {
      const stateWeight = { externally_verified: 2, founder_approved: 1, proposed: 0 };
      const stateDifference = (stateWeight[right.status] ?? 0) - (stateWeight[left.status] ?? 0);
      return stateDifference || left.eligibleArticleSlugs.length - right.eligibleArticleSlugs.length || left.id.localeCompare(right.id);
    })[0];
}

function previewIdentityApprovalPrompt(pullRequestNumber, plan = null) {
  const exactPlan = plan ? ` Approve only repository plan SHA-256 ${plan.configSha256} for head ${plan.approvedHeadSha}; its issue submission records approval evidence but does not execute cloud commands.` : '';
  return `Approve creation of Workload Identity pool tips-github-preview and provider github-preview for repository ID 171694140, repository-owner ID 23782501, actor ID 23782501, event pull_request, ref refs/pull/${pullRequestNumber}/merge, and job_workflow_ref lucasdmoyer/tipsforyourgifts/.github/workflows/firebase-preview-deploy.yml@refs/heads/master. Grant roles/iam.workloadIdentityUser on github-action-171694140@tipsforyourgifts.iam.gserviceaccount.com. Retain Firebase Hosting Admin only. No Firebase Auth Admin, no user-managed key, no production-provider changes, and no production deployment.${exactPlan}`;
}

export function strategyApprovalIssueUrl(idea) {
  const decision = {
    schemaVersion: '1.0.0',
    ideaId: idea.id,
    expectedRevision: idea.revision,
    ideaSha256: canonicalIdeaSha256(idea),
    decision: 'approve_for_research'
  };
  const title = `[Approve Strategy] ${idea.id} revision ${idea.revision}`;
  const body = [
    '# Approve one strategy thesis for research',
    '',
    'Lucas, this is the exact founder decision prepared by Studio. Review the proposal, check all three authority boxes, then submit the issue. The workflow will independently verify this packet before it can open an approval pull request.',
    '',
    '## Proposal',
    '',
    `- **Idea:** ${idea.id}, revision ${idea.revision}`,
    `- **Title:** ${idea.title}`,
    `- **Priority:** ${idea.priority}`,
    `- **Audience:** ${idea.audience}`,
    `- **Research brief:** ${idea.researchBrief}`,
    '',
    '## Exact decision',
    '',
    '```json',
    JSON.stringify(decision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...strategyApprovalAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    '> All three boxes must be checked. Submitting this issue does not change strategy data directly; it asks the protected workflow to create a deterministic, reviewable pull request.'
  ].join('\n');
  const url = new URL('https://github.com/lucasdmoyer/tipsforyourgifts/issues/new');
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  return url.toString().length <= 12_000
    ? url.toString()
    : 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/strategy-approval.yml';
}

export function buildFounderAgenda(input) {
  const decisions = [];
  const release = input.publicationManifest;
  const latestLiveRelease = input.livePublication.latestVerifiedContentRelease;
  const latestVerifiedPreview = input.automationReadinessEvidence?.latestVerifiedPreview?.status === 'exact_preview_verified'
    ? input.automationReadinessEvidence.latestVerifiedPreview
    : null;
  const approvedExactRelease = input.releaseApprovals?.currentContentSetApprovedRelease ?? null;
  const firebasePreviewIdentityPlan = input.firebasePreviewIdentityPlan ?? null;
  if (approvedExactRelease && firebasePreviewIdentityPlan && (firebasePreviewIdentityPlan.pullRequestNumber !== approvedExactRelease.pullRequestNumber || firebasePreviewIdentityPlan.approvedHeadSha !== approvedExactRelease.headSha)) {
    throw new Error('Firebase preview identity plan must match the exact approved release');
  }
  const candidateContentIsVerifiedLive = input.livePublication.status === 'verified_managed_content_release' &&
    latestLiveRelease?.publicationManifest.contentSetSha256 === release.contentSetSha256;
  if (release.counts.articles > 0 && !candidateContentIsVerifiedLive) {
    const hasManagedLiveRelease = Boolean(latestLiveRelease);
    decisions.push({
      id: 'review-release-candidate',
      rank: 0,
      priorityScore: 100,
      horizon: 'now',
      category: 'release',
      title: approvedExactRelease
        ? 'Unblock the approved exact release'
        : hasManagedLiveRelease ? 'Review the next accountable Angular release' : 'Review the first accountable Angular release',
      recommendation: approvedExactRelease
        ? `Preserve the merge-only approval for PR ${approvedExactRelease.pullRequestNumber} head ${approvedExactRelease.headSha}; authorize only the missing keyless preview trust if you want the protected check rerun.`
        : `Review ${release.manifestId} as the ${hasManagedLiveRelease ? 'next' : 'first'} founder-controlled Firebase release candidate.`,
      decisionQuestion: approvedExactRelease
        ? `Do you authorize the narrow PR-${approvedExactRelease.pullRequestNumber}-only OIDC trust required to rerun its protected preview check?`
        : hasManagedLiveRelease ? 'Should this exact reviewed content set replace the currently verified live set?' : 'Does this exact content set represent the site you want readers to see first?',
      rationale: approvedExactRelease
        ? 'The founder decision and hosted preview review are already recorded against one immutable pull request head. The merge remains blocked only because the required GitHub preview check cannot obtain its missing short-lived Google identity.'
        : hasManagedLiveRelease
          ? 'The candidate adds reviewed content and operating improvements beyond the verified live set, but it must retain exact-SHA preview, rollback, and founder-control evidence before replacement.'
          : 'The research and release machinery cannot create traffic, trust, or revenue while the modern reviewed site remains only a local candidate.',
      evidence: approvedExactRelease ? [
        `Lucas approved PR ${approvedExactRelease.pullRequestNumber} head ${approvedExactRelease.headSha} for merge only on ${approvedExactRelease.approvedAt}.`,
        `The approved content set is ${approvedExactRelease.manifestId}, matching this candidate manifest.`,
        `The exact Firebase preview remains ${approvedExactRelease.previewUrl}.`,
        latestLiveRelease
          ? `The latest Git-recorded live content set is ${latestLiveRelease.publicationManifest.manifestId}, so production has not advanced to the approved candidate.`
          : 'No managed Firebase content-release receipt is durably recorded in Git yet.',
        ...(firebasePreviewIdentityPlan ? [`The review-only identity plan is SHA-256 ${firebasePreviewIdentityPlan.configSha256}; its mobile issue packet cannot execute gcloud or deploy Firebase.`] : [])
      ] : [
        `${release.counts.articles} publication-ready articles are in the candidate set.`,
        `${release.counts.independentReviews} independent QA receipts are hash-bound to those articles.`,
        latestVerifiedPreview
          ? `The latest verified preview was ${latestVerifiedPreview.sha} at ${latestVerifiedPreview.pullRequestUrl}; that receipt does not authorize this build.`
          : `${release.counts.socialDrafts} reviewed social drafts are prepared for later distribution.`,
        latestLiveRelease
          ? `The latest Git-recorded live content set is ${latestLiveRelease.publicationManifest.manifestId}, which differs from this candidate.`
          : 'No managed Firebase content-release receipt is durably recorded in Git yet.'
      ],
      unlocks: 'A protected exact-SHA preview and founder-reviewed Firebase release establish the owned destination for every later growth and affiliate action.',
      tradeoff: approvedExactRelease
        ? 'Creating a tightly scoped keyless preview identity adds IAM configuration, but it does not grant production authority and can remain limited to this one pull request merge ref.'
        : hasManagedLiveRelease
          ? 'Replacing the live set advances the publication but creates a new monitoring and rollback obligation; affiliate and social authority remain separately bounded.'
          : 'The first release creates a public baseline and monitoring responsibility, while affiliate links and social publishing remain separately disabled.',
      guardrail: approvedExactRelease
        ? `The approval applies only to ${approvedExactRelease.headSha} and merge of PR ${approvedExactRelease.pullRequestNumber}. It does not transfer to a changed head, merge commit, replay, later artifact, IAM change, credential, or Firebase production deployment.`
        : `Commit and review the exact candidate first; the workflow must still clone live, expose the preview, require founder approval, smoke production, and mint a manifest-bound receipt.${latestVerifiedPreview ? ` The prior ${latestVerifiedPreview.sha} receipt is historical evidence only.` : ''}`,
      reversibility: 'high',
      founderActionRequired: true,
      action: {
        label: approvedExactRelease ? (firebasePreviewIdentityPlan ? 'Review exact identity plan' : 'Open approved release') : 'Open release workflow',
        url: approvedExactRelease ? (firebasePreviewIdentityPlan?.approvalIssueUrl ?? approvedExactRelease.pullRequestUrl) : 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/firebase-production.yml',
        command: approvedExactRelease
          ? previewIdentityApprovalPrompt(approvedExactRelease.pullRequestNumber, firebasePreviewIdentityPlan)
          : 'gh workflow run firebase-production.yml -f release_sha=<approved-master-sha>'
      }
    });
  }

  const strategyCandidate = selectStrategyCandidate(input.strategy);
  if (strategyCandidate) {
    const proposalQueueIsFull = input.openStrategyProposals >= input.maxOpenStrategyProposals;
    const proposalCapacityRemaining = Math.max(input.maxOpenStrategyProposals - input.openStrategyProposals, 0);
    decisions.push({
      id: 'choose-next-thesis',
      rank: 0,
      priorityScore: 95,
      horizon: 'now',
      category: 'editorial_direction',
      title: 'Choose the next recipient problem to research',
      recommendation: `Approve ${strategyCandidate.id} revision ${strategyCandidate.revision}: ${strategyCandidate.title}.`,
      decisionQuestion: 'Should this be the next bounded research mission for the editorial team?',
      rationale: proposalQueueIsFull
        ? 'The founder proposal queue has reached its configured cap, so one decision both chooses the next article direction and restores capacity to the autonomous opportunity scout.'
        : `The proposal is awaiting founder direction, and ${proposalCapacityRemaining} of ${input.maxOpenStrategyProposals} proposal slots remain available; deciding it now chooses the next article direction without pretending the research is already approved.`,
      evidence: [
        `${input.openStrategyProposals}/${input.maxOpenStrategyProposals} founder proposal slots are occupied.`,
        `The recommended thesis has ${strategyCandidate.priority} strategic priority.`,
        strategyCandidate.pairing
          ? `Its pair-coherence hypothesis scores ${strategyCandidate.pairing.coherenceScore}/100 before product research.`
          : 'This is a single-product or category thesis; no pair-coherence claim is being made before product research.',
        `The brief requires ${strategyCandidate.deliverables.minimumFinalists} finalists, ${strategyCandidate.deliverables.minimumQualifiedPairs} qualified pairs, and ${strategyCandidate.deliverables.minimumSocialAngles} social angles.`
      ],
      unlocks: proposalQueueIsFull
        ? 'Merging the deterministic approval pull request starts one hash-bound research mission and reopens one weekly opportunity-scout slot.'
        : 'Merging the deterministic approval pull request starts one hash-bound research mission while the autonomous opportunity scout retains the capacity already shown in Studio.',
      tradeoff: 'Approval spends research capacity on one audience and ritual before product evidence has been collected; the mission may still reject the thesis.',
      guardrail: 'This action authorizes research only. It cannot approve evidence, add affiliate tracking, publish content, spend money, or deploy Firebase.',
      reversibility: 'high',
      founderActionRequired: true,
      action: {
        label: 'Review exact approval',
        url: strategyApprovalIssueUrl(strategyCandidate),
        command: `gh workflow run strategy-approval.yml -f idea_id=${strategyCandidate.id} -f expected_revision=${strategyCandidate.revision}`
      }
    });
  }

  const activeConnectors = input.growth.connectors.filter((connector) => connector.status === 'active');
  const searchConnector = input.growth.connectors.find((connector) => connector.id === 'search-console');
  if (activeConnectors.length === 0 || input.growth.snapshots.length === 0) {
    const configured = searchConnector?.status === 'configured';
    const active = searchConnector?.status === 'active';
    decisions.push({
      id: 'establish-measurement',
      rank: 0,
      priorityScore: 85,
      horizon: 'next',
      category: 'measurement',
      title: active ? 'Collect the first aggregate organic-search baseline' : configured ? 'Activate the configured Search Console boundary' : 'Configure the first aggregate measurement source',
      recommendation: active
        ? 'Run the read-only finalized Search Console collector and let its aggregate snapshot pass the full pull-request gates.'
        : configured
          ? 'Activate the exact reviewed Search Console configuration so its scheduled read-only collector can begin.'
          : 'Review the credential-free issue 59 decision packet, then configure only its exact URL-prefix property and read-only page-aggregate boundary.',
      decisionQuestion: active
        ? 'Do you want the team to collect the first finalized seven-day organic-search snapshot now?'
        : configured
          ? 'Do you authorize this exact configured property and OIDC boundary for read-only aggregate collection?'
          : 'Do you approve configuring the low-data first measurement path for organic discovery?',
      rationale: 'Traffic, conversions, and revenue are currently unknown. Measurement must exist before the team can distinguish useful growth work from activity.',
      evidence: [
        `${activeConnectors.length}/${input.growth.connectors.length} growth connectors are active.`,
        `${input.growth.snapshots.length} complete aggregate measurement snapshots are available.`,
        `${input.growth.experiments.filter((experiment) => experiment.founderDisposition === 'proposed').length} experiments are proposed but cannot run without a baseline.`,
        searchConnector?.nextGate ?? 'Search measurement still requires founder approval.'
      ],
      unlocks: 'A complete baseline lets the growth lead rank articles by real search demand and propose experiments with measurable stop conditions.',
      tradeoff: 'Even aggregate measurement adds account, access, and review work, but starting with search avoids unnecessary behavioral tracking.',
      guardrail: 'Use the exact URL-prefix property, read-only OAuth scope, page filters only, finalized seven-day windows, no raw queries, no identifiers, and no experiment activation from partial data.',
      reversibility: 'high',
      founderActionRequired: true,
      action: {
        label: active ? 'Collect first snapshot' : configured ? 'Open measurement activation' : 'Open measurement decision packet',
        url: active
          ? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-collect.yml'
          : configured
            ? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-activate.yml'
            : searchConsoleDecisionPacketUrl,
        command: active
          ? 'gh workflow run search-console-collect.yml'
          : configured
            ? `gh workflow run search-console-activate.yml -f expected_growth_sha256=${input.growthSha256} -f confirmation=ACTIVATE-search-console`
            : `gh workflow run search-console-configure.yml -f expected_growth_sha256=${input.growthSha256} -f property_reference=https://tipsforyourgifts.web.app/ -f configuration_evidence_url=${searchConsoleDecisionPacketUrl} -f confirmation=CONFIGURE-search-console`
      }
    });
  }

  const activeChannels = input.socialChannels.channels.filter((channel) => channel.status === 'active');
  if (activeChannels.length === 0 && input.socialDraftCount > 0) {
    const firstChannel = [...input.socialChannels.channels].sort((left, right) => left.priority - right.priority)[0];
    const channelConfigured = firstChannel.status === 'configured';
    decisions.push({
      id: 'configure-first-social-channel',
      rank: 0,
      priorityScore: 75,
      horizon: 'next',
      category: 'distribution',
      title: channelConfigured ? 'Activate the configured Pinterest publishing boundary' : 'Complete the first Pinterest operating packet',
      recommendation: channelConfigured
        ? `Activate ${firstChannel.id} only after rechecking its configured account, official target, API credential reference, cadence, and protected publishing environment.`
        : 'Complete credential-free issue 61, then configure Pinterest only after the exact business account, public board, Standard API access, minimum scopes, rights, cadence, and reporting boundary are evidenced.',
      decisionQuestion: channelConfigured
        ? 'Do you authorize this exact configured Pinterest channel for protected per-post official-API publishing?'
        : 'Do you want to establish the official Pinterest operating envelope for the prepared launch queue?',
      rationale: 'The team has reusable decision-first creative, but drafts cannot drive traffic until one official channel has a founder-approved and measurable publishing boundary.',
      evidence: [
        `${input.socialDraftCount} reviewed social drafts are prepared.`,
        `${input.socialCreativeCandidateCount} original creative candidate${input.socialCreativeCandidateCount === 1 ? ' is' : 's are'} locally verified.`,
        `${activeChannels.length}/${input.socialChannels.channels.length} official social channels are active.`,
        `${firstChannel.id} is channel priority ${firstChannel.priority}.`
      ],
      unlocks: channelConfigured
        ? 'Active status makes separately approved posts eligible for the protected official-API workflow; it does not publish any post by itself.'
        : 'A configured channel allows byte-level media approval and content approval; active status later enables only protected per-post official-API publishing.',
      tradeoff: 'An owned social account creates moderation, policy, rights, and cadence obligations before it produces measurable traffic.',
      guardrail: 'Do not browser-post or store credentials in Git. Keep every post separately approved and require an official external post ID before calling it published.',
      reversibility: 'medium',
      founderActionRequired: true,
      action: {
        label: channelConfigured ? 'Open channel activation' : 'Open Pinterest decision packet',
        url: channelConfigured
          ? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-activate.yml'
          : pinterestDecisionPacketUrl,
        command: channelConfigured
          ? `gh workflow run social-channel-activate.yml -f channel_id=${firstChannel.id} -f expected_config_sha256=${input.socialChannelsSha256} -f confirmation=ACTIVATE-${firstChannel.id}`
          : `gh workflow run social-channel-configure.yml -f channel_id=${firstChannel.id} -f expected_config_sha256=${input.socialChannelsSha256} -f official_account_reference="$PINTEREST_ACCOUNT_REFERENCE" -f official_publication_target_id="$PINTEREST_BOARD_ID" -f max_posts_per_week=3 -f configuration_evidence_url=${pinterestDecisionPacketUrl} -f confirmation=CONFIGURE-${firstChannel.id}`
      }
    });
  }

  const affiliatePilot = selectAffiliatePilot(input.affiliate);
  const enabledPrograms = input.affiliate.programs.filter((program) => program.enabled);
  if (enabledPrograms.length === 0 && affiliatePilot) {
    const readyForActivationReview = affiliatePilot.status === 'externally_verified';
    decisions.push({
      id: 'choose-affiliate-pilot',
      rank: 0,
      priorityScore: 65,
      horizon: 'later',
      category: 'monetization',
      title: readyForActivationReview ? 'Complete the audited affiliate activation review' : 'Choose a narrow affiliate onboarding pilot',
      recommendation: readyForActivationReview
        ? `Activate ${affiliatePilot.name} only after external enrollment, current terms acceptance, registered-site, tracking, domain, disclosure, and reporting evidence are complete.`
        : `Review ${affiliatePilot.name} first because it has the smallest current eligible-article footprint.`,
      decisionQuestion: readyForActivationReview
        ? 'Has every external enrollment and current-terms requirement been completed and recorded for this exact revision?'
        : 'Is this program worth the external account, terms, disclosure, and reporting burden?',
      rationale: 'A narrow pilot can test operational fit with less commission pressure than enabling the broadest catalog before traffic and conversion evidence exist.',
      evidence: [
        `${input.affiliate.programs.filter((program) => program.status === 'proposed').length} affiliate programs await founder review, ${input.affiliate.programs.filter((program) => program.status === 'founder_approved').length} await external enrollment, and ${input.affiliate.programs.filter((program) => program.status === 'externally_verified').length} await activation evidence.`,
        `${enabledPrograms.length} programs and ${input.publicationManifest.counts.affiliateLinks} tracked links are enabled.`,
        `${affiliatePilot.name} currently maps to ${affiliatePilot.eligibleArticleSlugs.length} publication-ready article.`,
        `Its public terms review expires ${affiliatePilot.sourceReviewExpiresAt}.`
      ],
      unlocks: readyForActivationReview
        ? 'A passing activation PR enables only contract-validated paid-link candidates; every destination and disclosure remains separately reviewable.'
        : 'Founder approval permits external onboarding review; a later audited activation can allow validated paid links without changing editorial rank.',
      tradeoff: 'Enrollment and reporting add compliance work, while a narrow program covers fewer products and cannot monetize every companion in a pair.',
      guardrail: readyForActivationReview
        ? 'Record only founder-completed external facts and non-secret configuration; activation cannot invent a tracking identity, change editorial ranking, or make any link live by itself.'
        : 'Approval does not accept terms, create an account, enable links, invent a tracking identity, or change product ranking.',
      reversibility: 'high',
      founderActionRequired: true,
      action: {
        label: readyForActivationReview ? 'Open activation handoff' : 'Open affiliate review',
        url: readyForActivationReview
          ? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-activate.yml'
          : 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-approval.yml',
        command: readyForActivationReview
          ? null
          : `gh workflow run affiliate-program-approval.yml -f program_id=${affiliatePilot.id} -f expected_revision=${affiliatePilot.revision}`
      }
    });
  } else if (enabledPrograms.length > 0) {
    const reviewPending = input.affiliateLinks.queue.find((candidate) => candidate.stage === 'independent_review_required');
    const approvalPending = input.affiliateLinks.queue.find((candidate) => candidate.stage === 'founder_approval_required');
    const failedCandidate = input.affiliateLinks.queue.find((candidate) => candidate.stage === 'review_failed');
    const candidate = approvalPending ?? reviewPending ?? failedCandidate;
    if (input.affiliateLinks.activeOverlays === 0 || candidate) {
      const mode = approvalPending ? 'approve' : reviewPending ? 'review' : failedCandidate ? 'replace' : 'create';
      decisions.push({
        id: 'choose-affiliate-pilot',
        rank: 0,
        priorityScore: 65,
        horizon: 'later',
        category: 'monetization',
        title: mode === 'approve' ? 'Decide on one independently reviewed paid link' : mode === 'review' ? 'Send the first exact paid link to evidence review' : mode === 'replace' ? 'Replace the failed paid-link candidate' : 'Choose one existing editorial winner for a paid-link pilot',
        recommendation: mode === 'approve'
          ? `Review and approve ${candidate.candidateId} only if its exact destination and separate evidence receipt are acceptable.`
          : mode === 'review'
            ? `Run the isolated evidence editor for ${candidate.candidateId}; a candidate alone remains inert.`
            : mode === 'replace'
              ? `Leave ${candidate.candidateId} blocked and create an incremented candidate only after its stated evidence problem is corrected.`
              : `Start with one product from ${enabledPrograms[0].eligibleArticleSlugs[0]} that already won on editorial merit.`,
        decisionQuestion: mode === 'approve'
          ? 'Do you approve this exact candidate and clean review hashes for a preview-only paid-link overlay?'
          : mode === 'review'
            ? 'Should the independent evidence editor verify this exact destination now?'
            : mode === 'replace'
              ? 'Has the failed destination or evidence problem been corrected enough to create a new immutable candidate revision?'
              : 'Which already-recommended product should receive the first bounded affiliate-link candidate?',
        rationale: 'Program activation alone cannot prove that one tracked URL still lands on the intended product, preserves approved tracking, and leaves the recommendation useful without commission.',
        evidence: [
          `${enabledPrograms.length} affiliate program is enabled and ${input.affiliateLinks.activeOverlays} paid-link overlays are active.`,
          `${input.affiliateLinks.candidates} exact candidates, ${input.affiliateLinks.passedReviews} clean independent reviews, and ${input.affiliateLinks.approvals} founder approvals are recorded.`,
          candidate ? `${candidate.candidateId} is at ${candidate.stage}.` : 'No exact product-level paid-link candidate exists yet.',
          `${input.publicationManifest.counts.affiliateLinks} paid links are bound into the current release manifest.`
        ],
        unlocks: 'One approved overlay creates a measurable monetization pilot without rewriting product order, scores, gift logic, pairings, or raw editorial evidence.',
        tradeoff: 'A paid-link pilot adds destination monitoring, disclosure, terms, and reader-trust obligations before conversion evidence exists.',
        guardrail: 'Require exact candidate, independent review, and founder approval hashes; then inspect the Firebase preview. Approval does not authorize production deployment.',
        reversibility: 'high',
        founderActionRequired: true,
        action: mode === 'approve' ? {
          label: 'Open exact-link approval',
          url: candidate.approvalIssueUrl ?? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-approval.yml',
          command: `gh workflow run affiliate-link-approval.yml -f candidate_id=${candidate.candidateId} -f expected_candidate_sha256=${candidate.candidateSha256} -f expected_review_sha256=${candidate.reviewSha256} -f confirmation=APPROVE-${candidate.candidateId}`
        } : mode === 'review' ? {
          label: 'Open independent review',
          url: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-review.yml',
          command: `gh workflow run affiliate-link-review.yml -f candidate_id=${candidate.candidateId} -f expected_candidate_sha256=${candidate.candidateSha256}`
        } : {
          label: 'Open link candidate',
          url: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-candidate.yml',
          command: null
        }
      });
    }
  }

  const ranked = decisions
    .sort((left, right) => right.priorityScore - left.priorityScore || left.id.localeCompare(right.id))
    .slice(0, 5)
    .map((decision, index) => ({ ...decision, rank: index + 1 }));
  return founderAgendaSchema.parse({
    schemaVersion: '1.0.0',
    generatedAt: input.generatedAt,
    posture: 'founder_decisions_required',
    primaryDecisionId: ranked[0]?.id,
    profitabilityEvidence: 'unknown_until_aggregate_measurement',
    operatingPrinciple: 'measure_before_scaling_and_rank_before_commission',
    decisions: ranked
  });
}

export function parseFounderAgenda(value) {
  return founderAgendaSchema.parse(value);
}
