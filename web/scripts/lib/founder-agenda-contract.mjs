import { z } from 'zod';

const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');
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
    .filter((program) => ['proposed', 'founder_approved'].includes(program.status))
    .sort((left, right) => {
      const stateDifference = Number(right.status === 'founder_approved') - Number(left.status === 'founder_approved');
      return stateDifference || left.eligibleArticleSlugs.length - right.eligibleArticleSlugs.length || left.id.localeCompare(right.id);
    })[0];
}

export function buildFounderAgenda(input) {
  const decisions = [];
  const release = input.publicationManifest;
  const latestLiveRelease = input.livePublication.latestVerifiedContentRelease;
  const candidateContentIsVerifiedLive = input.livePublication.status === 'verified_managed_content_release' &&
    latestLiveRelease?.publicationManifest.contentSetSha256 === release.contentSetSha256;
  if (release.counts.articles > 0 && !candidateContentIsVerifiedLive) {
    decisions.push({
      id: 'review-release-candidate',
      rank: 0,
      priorityScore: 100,
      horizon: 'now',
      category: 'release',
      title: 'Review the first accountable Angular release',
      recommendation: `Review ${release.manifestId} as the first founder-controlled Firebase release candidate.`,
      decisionQuestion: 'Does this exact content set represent the site you want readers to see first?',
      rationale: 'The research and release machinery cannot create traffic, trust, or revenue while the modern reviewed site remains only a local candidate.',
      evidence: [
        `${release.counts.articles} publication-ready articles are in the candidate set.`,
        `${release.counts.independentReviews} independent QA receipts are hash-bound to those articles.`,
        `${release.counts.socialDrafts} reviewed social drafts are prepared for later distribution.`,
        latestLiveRelease
          ? `The latest Git-recorded live content set is ${latestLiveRelease.publicationManifest.manifestId}, which differs from this candidate.`
          : 'No managed Firebase content-release receipt is durably recorded in Git yet.'
      ],
      unlocks: 'A protected exact-SHA preview and founder-reviewed Firebase release establish the owned destination for every later growth and affiliate action.',
      tradeoff: 'The first release creates a public baseline and monitoring responsibility, while affiliate links and social publishing remain separately disabled.',
      guardrail: 'Commit and review the exact candidate first; the workflow must still clone live, expose the preview, require founder approval, smoke production, and mint a manifest-bound receipt.',
      reversibility: 'high',
      founderActionRequired: true,
      action: {
        label: 'Open release workflow',
        url: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/firebase-production.yml',
        command: 'gh workflow run firebase-production.yml -f release_sha=<approved-master-sha>'
      }
    });
  }

  const strategyCandidate = selectStrategyCandidate(input.strategy);
  if (strategyCandidate) {
    decisions.push({
      id: 'choose-next-thesis',
      rank: 0,
      priorityScore: 95,
      horizon: 'now',
      category: 'editorial_direction',
      title: 'Choose the next recipient problem to research',
      recommendation: `Approve ${strategyCandidate.id} revision ${strategyCandidate.revision}: ${strategyCandidate.title}.`,
      decisionQuestion: 'Should this be the next bounded research mission for the editorial team?',
      rationale: 'The founder proposal queue is full, so one decision both chooses the next article direction and restores capacity to the autonomous opportunity scout.',
      evidence: [
        `${input.openStrategyProposals}/${input.maxOpenStrategyProposals} founder proposal slots are occupied.`,
        `The recommended thesis has ${strategyCandidate.priority} strategic priority.`,
        `Its pair-coherence hypothesis scores ${strategyCandidate.pairing?.coherenceScore ?? 'not applicable'}/100 before product research.`,
        `The brief requires ${strategyCandidate.deliverables.minimumFinalists} finalists, ${strategyCandidate.deliverables.minimumQualifiedPairs} qualified pairs, and ${strategyCandidate.deliverables.minimumSocialAngles} social angles.`
      ],
      unlocks: 'Merging the deterministic approval pull request starts one hash-bound research mission and reopens one weekly opportunity-scout slot.',
      tradeoff: 'Approval spends research capacity on one audience and ritual before product evidence has been collected; the mission may still reject the thesis.',
      guardrail: 'This action authorizes research only. It cannot approve evidence, add affiliate tracking, publish content, spend money, or deploy Firebase.',
      reversibility: 'high',
      founderActionRequired: true,
      action: {
        label: 'Open strategy approval',
        url: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/strategy-approval.yml',
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
          : 'Start with the exact canonical URL-prefix property and read-only page aggregates before adding broader analytics.',
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
        label: active ? 'Collect first snapshot' : configured ? 'Open measurement activation' : 'Open measurement setup',
        url: active
          ? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-collect.yml'
          : configured
            ? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-activate.yml'
            : 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-configure.yml',
        command: active
          ? 'gh workflow run search-console-collect.yml'
          : configured
            ? `gh workflow run search-console-activate.yml -f expected_growth_sha256=${input.growthSha256} -f confirmation=ACTIVATE-search-console`
            : `gh workflow run search-console-configure.yml -f expected_growth_sha256=${input.growthSha256} -f property_reference=https://tipsforyourgifts.web.app/ -f configuration_evidence_url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/REPLACE_WITH_ISSUE_NUMBER -f confirmation=CONFIGURE-search-console`
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
      title: channelConfigured ? 'Activate the configured Pinterest publishing boundary' : 'Decide whether Pinterest becomes the first owned distribution channel',
      recommendation: channelConfigured
        ? `Activate ${firstChannel.id} only after rechecking its configured account, official target, API credential reference, cadence, and protected publishing environment.`
        : `Configure ${firstChannel.id} as the first bounded channel only after the official account, API, rights, cadence, and reporting posture are approved.`,
      decisionQuestion: channelConfigured
        ? 'Do you authorize this exact configured Pinterest channel for protected per-post official-API publishing?'
        : 'Do you want to establish the official Pinterest operating envelope for the prepared launch queue?',
      rationale: 'The team has reusable decision-first creative, but drafts cannot drive traffic until one official channel has a founder-approved and measurable publishing boundary.',
      evidence: [
        `${input.socialDraftCount} reviewed social drafts are prepared.`,
        `${input.socialCreativeCandidateCount} original creative candidate is locally verified.`,
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
        label: channelConfigured ? 'Open channel activation' : 'Open channel setup',
        url: channelConfigured
          ? 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-activate.yml'
          : 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-configure.yml',
        command: channelConfigured
          ? `gh workflow run social-channel-activate.yml -f channel_id=${firstChannel.id} -f expected_config_sha256=${input.socialChannelsSha256} -f confirmation=ACTIVATE-${firstChannel.id}`
          : null
      }
    });
  }

  const affiliatePilot = selectAffiliatePilot(input.affiliate);
  const enabledPrograms = input.affiliate.programs.filter((program) => program.enabled);
  if (enabledPrograms.length === 0 && affiliatePilot) {
    const readyForActivationReview = affiliatePilot.status === 'founder_approved';
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
        `${input.affiliate.programs.filter((program) => program.status === 'proposed').length} affiliate programs await founder review and ${input.affiliate.programs.filter((program) => program.status === 'founder_approved').length} await external activation evidence.`,
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
          ? `gh workflow run affiliate-program-activate.yml -f program_id=${affiliatePilot.id} -f expected_revision=${affiliatePilot.revision} -f confirmation=ACTIVATE-${affiliatePilot.id}`
          : `gh workflow run affiliate-program-approval.yml -f program_id=${affiliatePilot.id} -f expected_revision=${affiliatePilot.revision}`
      }
    });
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
