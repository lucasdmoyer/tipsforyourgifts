import { z } from 'zod';

const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');
const sha40 = z.string().regex(/^[a-f0-9]{40}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const teamStatus = z.enum([
  'ready',
  'limited_live',
  'blocked_external_configuration',
  'blocked_founder_configuration',
  'manual_fallback_verified',
  'founder_approval_required'
]);

const externalGateSchema = z.object({
  id: z.enum(['openai-platform-credential', 'firebase-preview-identity', 'firebase-auto-production-identity']),
  label: z.string().min(12),
  status: z.literal('blocked_external_configuration'),
  summary: z.string().min(60),
  evidenceUrl: httpsUrl,
  diagnosticUrl: httpsUrl,
  nextAction: z.string().min(60),
  authorityBoundary: z.string().min(80)
}).strict();

const latestVerifiedPreviewSchema = z.object({
  status: z.literal('exact_preview_verified'),
  sha: sha40,
  pullRequestUrl: httpsUrl,
  reviewUrl: httpsUrl,
  previewUrl: httpsUrl,
  immutableArtifact: z.object({
    source: z.literal('github_actions'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    artifactId: z.string().regex(/^[1-9]\d*$/),
    sha256
  }).strict().nullable(),
  summary: z.string().min(80),
  nextAction: z.string().min(60)
}).strict();

export const automationReadinessEvidenceSchema = z.object({
  schemaVersion: z.literal('1.2.0'),
  observedAt: z.string().datetime(),
  sourceMode: z.literal('versioned_snapshot_not_live_poll'),
  externalGates: z.array(externalGateSchema).length(3),
  latestVerifiedPreview: latestVerifiedPreviewSchema
}).strict().superRefine((evidence, context) => {
  const ids = evidence.externalGates.map((gate) => gate.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['externalGates'], message: 'external gate IDs must be unique' });
  for (const requiredId of ['openai-platform-credential', 'firebase-preview-identity', 'firebase-auto-production-identity']) {
    if (!ids.includes(requiredId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['externalGates'], message: `missing required gate ${requiredId}` });
  }
  const previewHost = new URL(evidence.latestVerifiedPreview.previewUrl).hostname;
  if (!previewHost.startsWith('tipsforyourgifts--') || !previewHost.endsWith('.web.app')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latestVerifiedPreview', 'previewUrl'], message: 'preview URL must use the owned Firebase preview site' });
  }
  const previewUrlNamesSha = previewHost.includes(evidence.latestVerifiedPreview.sha.slice(0, 7));
  if (!previewUrlNamesSha && evidence.latestVerifiedPreview.immutableArtifact === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latestVerifiedPreview', 'immutableArtifact'], message: 'a preview URL without the exact SHA prefix requires an immutable artifact identity' });
  }
  const pullRequestMatch = evidence.latestVerifiedPreview.pullRequestUrl.match(/^https:\/\/github\.com\/lucasdmoyer\/tipsforyourgifts\/pull\/(\d+)$/);
  if (!pullRequestMatch) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latestVerifiedPreview', 'pullRequestUrl'], message: 'verified preview must name an exact pull request in the owned repository' });
    return;
  }
  if (!evidence.latestVerifiedPreview.reviewUrl.startsWith(`${evidence.latestVerifiedPreview.pullRequestUrl}#`)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latestVerifiedPreview', 'reviewUrl'], message: 'review evidence must be an anchored receipt on the exact preview pull request' });
  }
  const previewGate = evidence.externalGates.find((gate) => gate.id === 'firebase-preview-identity');
  if (previewGate && !previewGate.evidenceUrl.startsWith(`${evidence.latestVerifiedPreview.pullRequestUrl}#`)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['externalGates'], message: 'preview identity evidence must belong to the exact latest verified preview pull request' });
  }
  if (previewGate && !previewGate.summary.includes(evidence.latestVerifiedPreview.sha)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['externalGates'], message: 'preview identity summary must name the exact latest verified preview SHA' });
  }
  if (previewGate && !previewGate.nextAction.includes(evidence.latestVerifiedPreview.sha)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['externalGates'], message: 'preview identity next action must remain bound to the exact latest verified preview SHA' });
  }
  const immutableArtifact = evidence.latestVerifiedPreview.immutableArtifact;
  if (immutableArtifact && previewGate && previewGate.diagnosticUrl !== `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${immutableArtifact.workflowRunId}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['externalGates'], message: 'preview diagnostic URL must bind the immutable artifact workflow run' });
  }
});

const teamSchema = z.object({
  id: z.enum(['research-generation', 'deterministic-quality', 'affiliate-monetization', 'social-distribution', 'growth-measurement', 'preview-delivery', 'production-release', 'automatic-publication']),
  label: z.string().min(6),
  status: teamStatus,
  evidence: z.string().min(20),
  nextAction: z.string().min(20),
  actionUrl: httpsUrl.nullable(),
  founderActionRequired: z.boolean()
}).strict();

export const automationReadinessSchema = z.object({
  schemaVersion: z.literal('1.2.0'),
  observedAt: z.string().datetime(),
  sourceMode: z.literal('versioned_snapshot_not_live_poll'),
  posture: z.literal('founder_action_required'),
  summary: z.string().min(80),
  counts: z.object({
    teams: z.number().int().positive(),
    ready: z.number().int().nonnegative(),
    limited: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    founderActions: z.number().int().nonnegative()
  }).strict(),
  teams: z.array(teamSchema).length(8),
  externalGates: z.array(externalGateSchema).length(3),
  latestVerifiedPreview: latestVerifiedPreviewSchema
}).strict().superRefine((readiness, context) => {
  const ids = readiness.teams.map((team) => team.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['teams'], message: 'team IDs must be unique' });
  const ready = readiness.teams.filter((team) => team.status === 'ready').length;
  const limited = readiness.teams.filter((team) => ['limited_live', 'manual_fallback_verified'].includes(team.status)).length;
  const blocked = readiness.teams.filter((team) => team.status.startsWith('blocked')).length;
  const founderActions = readiness.teams.filter((team) => team.founderActionRequired).length;
  for (const [field, actual] of Object.entries({ teams: readiness.teams.length, ready, limited, blocked, founderActions })) {
    if (readiness.counts[field] !== actual) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', field], message: `must equal derived ${field} count ${actual}` });
  }
});

export function buildAutomationReadiness(input) {
  const evidence = automationReadinessEvidenceSchema.parse(input.evidence);
  if (!Number.isInteger(input.durableFounderReviewedReleases) || input.durableFounderReviewedReleases < 0) throw new Error('durableFounderReviewedReleases must be a non-negative integer');
  if (!Number.isInteger(input.minimumFounderReviewedReleases) || input.minimumFounderReviewedReleases < 10) throw new Error('minimumFounderReviewedReleases must be an integer of at least 10');
  const gateById = new Map(evidence.externalGates.map((gate) => [gate.id, gate]));
  const openAiGate = gateById.get('openai-platform-credential');
  const firebaseGate = gateById.get('firebase-preview-identity');
  const autoProductionGate = gateById.get('firebase-auto-production-identity');
  const teams = [
    {
      id: 'research-generation',
      label: 'Research generation',
      status: openAiGate.status,
      evidence: openAiGate.summary,
      nextAction: openAiGate.nextAction,
      actionUrl: openAiGate.evidenceUrl,
      founderActionRequired: true
    },
    {
      id: 'deterministic-quality',
      label: 'Deterministic quality gates',
      status: 'ready',
      evidence: `${input.validatedRuns} validated research runs and ${input.publicationReadyPosts} publication-ready posts currently pass the versioned deterministic gates.`,
      nextAction: 'Keep drafting and independent review separate; every new research bundle must pass validation and build before release review.',
      actionUrl: null,
      founderActionRequired: false
    },
    {
      id: 'affiliate-monetization',
      label: 'Affiliate monetization',
      status: input.activeAffiliateOverlays > 0 ? 'limited_live' : 'blocked_founder_configuration',
      evidence: input.activeAffiliateOverlays > 0
        ? `${input.activeAffiliateOverlays} independently reviewed and founder-approved paid-link overlay is active; editorial source artifacts remain unchanged.`
        : 'No independently reviewed paid-link overlay is active.',
      nextAction: input.activeAffiliateOverlays > 0
        ? 'Measure the narrow pilot before expanding; keep affiliate economics separate from editorial rankings.'
        : 'Approve one narrow, independently reviewed affiliate pilot before any paid link can activate.',
      actionUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-review.yml',
      founderActionRequired: input.activeAffiliateOverlays === 0
    },
    {
      id: 'social-distribution',
      label: 'Social distribution',
      status: input.activeSocialChannels > 0 ? 'limited_live' : 'blocked_founder_configuration',
      evidence: `${input.socialDrafts} drafts are prepared; ${input.activeSocialChannels} official social channels are active.`,
      nextAction: input.activeSocialChannels > 0
        ? 'Publish only separately approved posts through the protected official API and retain external publication receipts.'
        : 'Approve one official account, rights boundary, cadence, and official API configuration before any post can publish.',
      actionUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-configure.yml',
      founderActionRequired: input.activeSocialChannels === 0
    },
    {
      id: 'growth-measurement',
      label: 'Aggregate growth measurement',
      status: input.activeGrowthConnectors > 0 && input.growthSnapshots > 0 ? 'limited_live' : 'blocked_founder_configuration',
      evidence: `${input.activeGrowthConnectors} aggregate connectors are active and ${input.growthSnapshots} complete measurement snapshots exist; unknown traffic is never reported as zero.`,
      nextAction: input.activeGrowthConnectors > 0
        ? 'Import one complete aggregate reporting window before ranking growth experiments.'
        : 'Configure the approved read-only Search Console page-aggregate boundary and establish the first complete baseline.',
      actionUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-configure.yml',
      founderActionRequired: input.activeGrowthConnectors === 0
    },
    {
      id: 'preview-delivery',
      label: 'Firebase preview delivery',
      status: 'manual_fallback_verified',
      evidence: `${evidence.latestVerifiedPreview.summary} This is the latest verified preview, not authority for the current build. Automated keyless delivery remains blocked: ${firebaseGate.summary}`,
      nextAction: firebaseGate.nextAction,
      actionUrl: firebaseGate.evidenceUrl,
      founderActionRequired: true
    },
    {
      id: 'production-release',
      label: 'Production release',
      status: 'founder_approval_required',
      evidence: `No master release is authorized by pull-request preview evidence. The latest verified preview was ${evidence.latestVerifiedPreview.sha}; after that reviewed pull request merges, the resulting exact master SHA still requires its own preview, readback, and action-time production approval.`,
      nextAction: evidence.latestVerifiedPreview.nextAction,
      actionUrl: evidence.latestVerifiedPreview.reviewUrl,
      founderActionRequired: true
    },
    {
      id: 'automatic-publication',
      label: 'Proven automatic publication',
      status: autoProductionGate.status,
      evidence: `${autoProductionGate.summary} The repository ledger contains ${input.durableFounderReviewedReleases} of ${input.minimumFounderReviewedReleases} durable verified founder-reviewed release receipts. Final activation still requires the live GitHub deployment recount and separate founder approval.`,
      nextAction: autoProductionGate.nextAction,
      actionUrl: autoProductionGate.evidenceUrl,
      founderActionRequired: true
    }
  ];
  const readiness = {
    schemaVersion: '1.2.0',
    observedAt: evidence.observedAt,
    sourceMode: evidence.sourceMode,
    posture: 'founder_action_required',
    summary: 'The operating system can validate content and run a narrow affiliate pilot today. Research generation, automated previews, distribution, measurement, release approval, and eventual keyless automatic publication still require explicit bounded founder actions.',
    counts: {
      teams: teams.length,
      ready: teams.filter((team) => team.status === 'ready').length,
      limited: teams.filter((team) => ['limited_live', 'manual_fallback_verified'].includes(team.status)).length,
      blocked: teams.filter((team) => team.status.startsWith('blocked')).length,
      founderActions: teams.filter((team) => team.founderActionRequired).length
    },
    teams,
    externalGates: evidence.externalGates,
    latestVerifiedPreview: evidence.latestVerifiedPreview
  };
  return automationReadinessSchema.parse(readiness);
}

export function parseAutomationReadinessEvidence(value) {
  return automationReadinessEvidenceSchema.parse(value);
}

export function parseAutomationReadiness(value) {
  return automationReadinessSchema.parse(value);
}
