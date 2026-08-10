import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { z } from 'zod';

const root = process.cwd();
const runsDir = path.join(root, 'research', 'runs');
const blogDir = path.join(root, 'src', 'data', 'blog');
const socialDir = path.join(root, 'social', 'drafts');
const reviewsDir = path.join(root, 'research', 'reviews');
const affiliateConfigPath = path.join(root, 'config', 'affiliate-programs.json');
const strategyPath = path.join(root, 'src', 'data', 'strategy.json');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*Z)?$/);
const sourceSchema = z.object({
  id: z.string().min(4),
  url: z.string().url().refine((value) => value.startsWith('https://'), 'sources must use HTTPS'),
  publisher: z.string().min(2),
  title: z.string().min(4),
  accessedAt: isoDate,
  sourceClass: z.string().min(3),
  trustTier: z.enum(['A', 'B', 'C', 'D']),
  independenceGroup: z.string().min(2)
});
const compatibilityCheckSchema = z.object({
  dimension: z.enum(['size_or_fit', 'device_or_ecosystem', 'power_or_battery', 'subscription_or_account', 'space_or_storage', 'skill_or_experience', 'accessibility', 'edition_or_region', 'not_applicable']),
  status: z.enum(['verified', 'not_applicable', 'unknown', 'failed']),
  requirement: z.string().min(20),
  claimIds: z.array(z.string()).default([])
});
const thoughtfulnessSchema = z.object({
  observationPrompt: z.string().min(40),
  frictionClaimIds: z.array(z.string()).min(1),
  physicalGiftBoundary: z.enum(['welcome_when_verified', 'unknown', 'declined']),
  selfPurchase: z.object({
    reason: z.enum(['replacement_inertia', 'research_burden', 'small_luxury_deferral', 'coordination_burden', 'not_applicable', 'unknown']),
    rationale: z.string().min(30),
    basis: z.enum(['social_demand', 'editorial_inference', 'recipient_observation_prompt']),
    claimIds: z.array(z.string()).default([])
  }),
  duplicateRisk: z.object({
    level: z.enum(['low', 'medium', 'high']),
    preGiftCheck: z.string().min(20).nullable()
  }),
  clutterRisk: z.object({
    level: z.enum(['low', 'medium', 'high']),
    ownershipBurden: z.string().min(20),
    mitigation: z.string().min(20)
  }),
  compatibilityChecks: z.array(compatibilityCheckSchema).min(1),
  score: z.object({
    frictionSpecificity: z.number().int().min(0).max(5),
    selfPurchaseLogic: z.number().int().min(0).max(5),
    ownershipEase: z.number().int().min(0).max(5),
    recipientSpecificity: z.number().int().min(0).max(5),
    total: z.number().int().min(0).max(20)
  })
});
const candidateSchema = z.object({
  id: z.string().min(3),
  name: z.string().min(3),
  editorialScore: z.number().min(0).max(100),
  evidenceConfidence: z.number().min(0).max(100),
  drawbacks: z.array(z.string().min(8)).default([]),
  primarySourceIds: z.array(z.string()).default([]),
  independentSourceIds: z.array(z.string()).default([]),
  claimIds: z.array(z.string()).default([]),
  evidenceMode: z.enum(['desk_research', 'hands_on']).default('desk_research'),
  thoughtfulness: thoughtfulnessSchema.optional()
});
const pairSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(8),
  anchorCandidateId: z.string().min(3),
  companionCandidateId: z.string().min(3),
  recipientJob: z.string().min(30),
  coherenceType: z.enum(['completes_task', 'enables_use', 'protects', 'organizes', 'maintains', 'narrative_counterpoint', 'practice_loop', 'observation_loop']),
  whyTogether: z.string().min(40),
  interactionMoment: z.string().min(30),
  compatibilityChecks: z.array(compatibilityCheckSchema).min(2),
  duplicateRisk: z.enum(['low', 'medium', 'high']),
  clutterDelta: z.enum(['reduces', 'neutral', 'adds']),
  preGiftCheck: z.string().min(20),
  bundleDrawback: z.string().min(30),
  claimIds: z.array(z.string()).min(1),
  score: z.object({
    sharedCuriosity: z.number().int().min(0).max(20),
    complementaryRoles: z.number().int().min(0).max(20),
    interactionLoop: z.number().int().min(0).max(20),
    observableTrigger: z.number().int().min(0).max(15),
    independentValue: z.number().int().min(0).max(10),
    compatibility: z.number().int().min(0).max(10),
    ownershipEase: z.number().int().min(0).max(5),
    total: z.number().int().min(0).max(100)
  })
});
const affiliateLinkSchema = z.object({
  productId: z.string().min(3),
  programId: z.string().min(2),
  url: z.string().url(),
  validatedAt: isoDate,
  finalDomain: z.string().min(3),
  trackingPreserved: z.boolean()
});
const runSchema = z.object({
  schemaVersion: z.enum(['1.0.0', '1.1.0']),
  runId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/),
  ideaId: z.string().min(3),
  ideaRevision: z.number().int().positive().optional(),
  ideaSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  decisionLens: z.enum(['recipient_friction', 'gift_pairing', 'hybrid']).optional(),
  contentType: z.enum(['editorial', 'roundup', 'single-product', 'comparison', 'pairing-guide']),
  status: z.enum(['researching', 'drafted', 'qa_failed', 'validated']),
  topic: z.string().min(12),
  audience: z.string().min(3),
  occasion: z.string().min(3),
  budgetBands: z.array(z.string()).min(1),
  riskClass: z.enum(['low', 'medium', 'high']),
  draftAuthor: z.string().min(3),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  researchPasses: z.array(z.object({
    pass: z.number().int().positive(),
    materialNoveltyRate: z.number().min(0).max(1),
    newCandidates: z.number().int().nonnegative(),
    newDecisionFactors: z.number().int().nonnegative()
  })).min(1),
  sources: z.array(sourceSchema),
  claims: z.array(z.object({
    id: z.string().min(4),
    kind: z.enum(['recipient_friction', 'self_purchase_pattern', 'product_benefit', 'product_drawback', 'compatibility', 'duplicate_clutter', 'pair_coherence', 'distribution']).optional(),
    text: z.string().min(12),
    risk: z.enum(['low', 'medium', 'high']),
    status: z.enum(['supported', 'conflicted', 'unsupported']),
    sourceIds: z.array(z.string()).min(1)
  })),
  candidates: z.array(candidateSchema),
  finalists: z.array(candidateSchema),
  pairs: z.array(pairSchema).optional(),
  affiliateLinks: z.array(affiliateLinkSchema),
  article: z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    editorialScore: z.number().min(0).max(100),
    evidenceConfidence: z.number().min(0).max(100),
    evidenceMode: z.enum(['desk_research', 'hands_on', 'editorial_standard']),
    status: z.enum(['draft', 'publication_ready'])
  }),
  qa: z.object({
    passed: z.boolean(),
    reviewerRole: z.literal('independent-editor'),
    reviewerId: z.string().min(3),
    receiptPath: z.string().regex(/^research\/reviews\/[a-z0-9-]+\.qa\.v1\.json$/),
    blockers: z.array(z.string()),
    warnings: z.array(z.string())
  })
});

const reviewReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-qa$/),
  runId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/),
  articleSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  reviewedAt: z.string().datetime(),
  reviewerRole: z.literal('independent-editor'),
  reviewerId: z.string().min(3),
  workflowRunId: z.string().min(1),
  verdict: z.enum(['passed', 'failed']),
  evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  articleSha256: z.string().regex(/^[a-f0-9]{64}$/),
  socialSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  blockers: z.array(z.string()),
  warnings: z.array(z.string())
});

const socialPostSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  platform: z.enum(['pinterest', 'instagram', 'tiktok']),
  format: z.string().min(4),
  status: z.enum(['draft', 'approved', 'published']),
  angle: z.string().min(10),
  headline: z.string().min(12).max(100),
  copy: z.string().min(40).max(500),
  assetBrief: z.string().min(20),
  altText: z.string().min(20).max(250),
  destinationUrl: z.string().url(),
  claimIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  pairIds: z.array(z.string()).default([]),
  disclosureRequired: z.boolean(),
  externalPostId: z.string().min(2).nullable()
});

const socialPackSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  packId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-launch$/),
  articleSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  researchRun: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/),
  status: z.enum(['draft', 'approved', 'published']),
  createdAt: z.string().datetime(),
  policy: z.object({
    officialApiRequired: z.literal(true),
    externalPublishingAuthorized: z.boolean(),
    containsAffiliateLinks: z.boolean()
  }),
  posts: z.array(socialPostSchema).min(5)
});

const strategyPairingSchema = z.object({
  unifyingIdea: z.string().min(30),
  itemRoles: z.array(z.object({
    item: z.string().min(4),
    role: z.string().min(20)
  })).length(2),
  interactionMoment: z.string().min(30),
  compatibilityChecks: z.array(z.string().min(20)).min(2),
  coherenceScore: z.number().int().min(0).max(100),
  clutterRisk: z.string().min(30)
});

const strategyIdeaSchema = z.object({
  id: z.string().regex(/^founder-idea-\d{3}$/),
  revision: z.number().int().positive(),
  founderDisposition: z.enum(['proposed', 'approved_for_research', 'paused', 'rejected']),
  ideaType: z.enum(['editorial', 'growth']),
  thesisType: z.enum(['recipient_friction', 'story_pairing', 'ritual_pairing', 'growth_distribution']),
  title: z.string().min(12),
  audience: z.string().min(12),
  occasion: z.string().min(3),
  budget: z.string().min(3),
  priority: z.enum(['high', 'medium', 'low']),
  insight: z.string().min(40),
  observedFriction: z.string().min(40),
  selfPurchaseReluctance: z.string().min(30),
  fitSignals: z.array(z.string().min(20)).min(2),
  avoidIf: z.array(z.string().min(20)).min(2),
  pairing: strategyPairingSchema.optional(),
  successMetric: z.string().min(25),
  deliverables: z.object({
    minimumFinalists: z.number().int().nonnegative(),
    minimumQualifiedPairs: z.number().int().nonnegative(),
    minimumSocialAngles: z.number().int().min(5)
  }),
  researchBrief: z.string().min(80)
}).superRefine((idea, context) => {
  const isPairing = ['story_pairing', 'ritual_pairing'].includes(idea.thesisType);
  if (isPairing && !idea.pairing) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pairing'], message: 'pairing theses require a two-item pairing contract' });
  }
  if (!isPairing && idea.pairing) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pairing'], message: 'pairing data is only allowed for a pairing thesis' });
  }
  if (idea.ideaType === 'growth' && idea.thesisType !== 'growth_distribution') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['thesisType'], message: 'growth ideas must use growth_distribution' });
  }
  if (idea.ideaType === 'editorial' && idea.thesisType === 'growth_distribution') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['thesisType'], message: 'editorial ideas cannot use growth_distribution' });
  }
  if (isPairing && idea.deliverables.minimumQualifiedPairs < 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliverables', 'minimumQualifiedPairs'], message: 'pairing ideas must require at least one qualified pair' });
  }
  if (idea.deliverables.minimumFinalists < idea.deliverables.minimumQualifiedPairs * 2) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliverables', 'minimumFinalists'], message: 'qualified pairs require two independently qualified finalists each' });
  }
  if (idea.ideaType === 'growth' && (idea.deliverables.minimumFinalists > 0 || idea.deliverables.minimumQualifiedPairs > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliverables'], message: 'growth-only ideas cannot require product finalists or pairs' });
  }
});

const strategySchema = z.object({
  schemaVersion: z.literal('1.1.0'),
  updatedAt: z.string().datetime(),
  northStar: z.string().min(30),
  currentBet: z.string().min(30),
  thoughtfulnessFramework: z.object({
    minimumPairCoherenceScore: z.number().int().min(80).max(100),
    principles: z.array(z.object({
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      label: z.string().min(8),
      question: z.string().min(30)
    })).min(5)
  }),
  ideas: z.array(strategyIdeaSchema).min(1)
});

async function filesUnder(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(fullPath, extension));
    if (entry.isFile() && entry.name.endsWith(extension)) files.push(fullPath);
  }
  return files;
}

function fail(errors) {
  console.error(`Content gate failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function impliesFirstHandExperience(body) {
  const pattern = /\b(we|i)\s+(tested|used|owned|tried)\b/gi;
  for (const match of body.matchAll(pattern)) {
    const start = Math.max(0, (match.index ?? 0) - 100);
    const context = body.slice(start, (match.index ?? 0) + match[0].length).toLowerCase();
    const isProhibitedExample = /(do not|don't|did not|didn't|never|without pretending|not to)\s+(say\s+)?[^.!?]{0,70}$/.test(context);
    if (!isProhibitedExample) return true;
  }
  return false;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function strategyIdeaDigest(idea) {
  return sha256(`${JSON.stringify(canonicalize(idea))}\n`);
}

function evidenceDigest(run) {
  const reviewable = structuredClone(run);
  delete reviewable.qa;
  delete reviewable.completedAt;
  reviewable.status = 'review_pending';
  reviewable.article.status = 'review_pending';
  return sha256(`${JSON.stringify(reviewable)}\n`);
}

function articleDigest(raw) {
  return sha256(raw.toString().replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending'));
}

const errors = [];
const warnings = [];
const affiliateConfig = JSON.parse(await fs.readFile(affiliateConfigPath, 'utf8'));
const enabledPrograms = new Map(affiliateConfig.programs.filter((program) => program.enabled).map((program) => [program.id, program]));

let strategy;
const strategyIdeasById = new Map();
try {
  strategy = strategySchema.parse(JSON.parse(await fs.readFile(strategyPath, 'utf8')));
} catch (error) {
  if (error instanceof z.ZodError) {
    for (const issue of error.issues) errors.push(`strategy.json ${issue.path.join('.')}: ${issue.message}`);
  } else {
    errors.push(`strategy.json: ${error.message}`);
  }
}

if (strategy) {
  const ideaIds = new Set(strategy.ideas.map((idea) => idea.id));
  const principleIds = new Set(strategy.thoughtfulnessFramework.principles.map((principle) => principle.id));
  const researchBriefs = new Set(strategy.ideas.map((idea) => idea.researchBrief.toLowerCase()));
  if (ideaIds.size !== strategy.ideas.length) errors.push('strategy.json idea IDs must be unique');
  if (principleIds.size !== strategy.thoughtfulnessFramework.principles.length) errors.push('strategy.json principle IDs must be unique');
  if (researchBriefs.size !== strategy.ideas.length) errors.push('strategy.json research briefs must be unique');
  for (const idea of strategy.ideas) {
    strategyIdeasById.set(idea.id, idea);
    if (!idea.pairing) continue;
    if (idea.pairing.coherenceScore < strategy.thoughtfulnessFramework.minimumPairCoherenceScore) {
      errors.push(`${idea.id}: pairing coherence is below the strategy minimum`);
    }
    const normalizedItems = new Set(idea.pairing.itemRoles.map((item) => item.item.toLowerCase()));
    if (normalizedItems.size !== idea.pairing.itemRoles.length) errors.push(`${idea.id}: pairing items must be distinct`);
  }
}

const articleFiles = await filesUnder(blogDir, '.md');
const articles = new Map();
for (const articleFile of articleFiles) {
  const raw = await fs.readFile(articleFile, 'utf8');
  const parsed = matter(raw);
  const slug = path.basename(articleFile, '.md');
  articles.set(slug, { file: articleFile, data: parsed.data, body: parsed.content });
}

const runFiles = await filesUnder(runsDir, '.json');
const seenRunIds = new Set();
const runsById = new Map();
for (const runFile of runFiles) {
  let run;
  try {
    run = runSchema.parse(JSON.parse(await fs.readFile(runFile, 'utf8')));
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) errors.push(`${path.basename(runFile)} ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    errors.push(`${path.basename(runFile)}: ${error.message}`);
    continue;
  }

  if (seenRunIds.has(run.runId)) errors.push(`${run.runId}: duplicate run ID`);
  seenRunIds.add(run.runId);
  runsById.set(run.runId, run);
  if (!path.basename(runFile, '.json').startsWith(run.runId)) errors.push(`${run.runId}: filename must begin with the run ID`);

  const strategyIdea = strategyIdeasById.get(run.ideaId);
  const runPairs = run.pairs ?? [];
  if (run.schemaVersion === '1.1.0') {
    if (!strategyIdea) errors.push(`${run.runId}: schema 1.1 run references an unknown strategy idea`);
    if (!run.ideaRevision) errors.push(`${run.runId}: schema 1.1 run requires ideaRevision`);
    if (!run.ideaSha256) errors.push(`${run.runId}: schema 1.1 run requires ideaSha256`);
    if (!run.decisionLens) errors.push(`${run.runId}: schema 1.1 run requires decisionLens`);
    if (strategyIdea) {
      if (strategyIdea.founderDisposition !== 'approved_for_research') errors.push(`${run.runId}: strategy idea is not founder-approved for research`);
      if (run.ideaRevision !== strategyIdea.revision) errors.push(`${run.runId}: strategy idea revision is stale`);
      if (run.ideaSha256 !== strategyIdeaDigest(strategyIdea)) errors.push(`${run.runId}: strategy idea digest is stale`);
      const expectedLens = ['story_pairing', 'ritual_pairing'].includes(strategyIdea.thesisType)
        ? 'gift_pairing'
        : strategyIdea.deliverables.minimumQualifiedPairs > 0 ? 'hybrid' : 'recipient_friction';
      if (run.decisionLens !== expectedLens) errors.push(`${run.runId}: decision lens does not match the approved strategy brief`);
      if (run.finalists.length < strategyIdea.deliverables.minimumFinalists) errors.push(`${run.runId}: does not meet the strategy minimum finalist count`);
      if (runPairs.length < strategyIdea.deliverables.minimumQualifiedPairs) errors.push(`${run.runId}: does not meet the strategy minimum qualified-pair count`);
    }
    for (const claim of run.claims) if (!claim.kind) errors.push(`${run.runId}: schema 1.1 claim ${claim.id} requires a kind`);
  }

  const sourceIds = new Set(run.sources.map((source) => source.id));
  if (sourceIds.size !== run.sources.length) errors.push(`${run.runId}: source IDs must be unique`);
  const claimIds = new Set(run.claims.map((claim) => claim.id));
  if (claimIds.size !== run.claims.length) errors.push(`${run.runId}: claim IDs must be unique`);
  const candidateIds = new Set(run.candidates.map((candidate) => candidate.id));
  if (candidateIds.size !== run.candidates.length) errors.push(`${run.runId}: candidate IDs must be unique`);
  const sourceClasses = new Set(run.sources.map((source) => source.sourceClass));
  const independenceGroups = new Set(run.sources.map((source) => source.independenceGroup));
  const minSources = run.contentType === 'editorial' ? 8 : 12;
  const minSourceClasses = run.contentType === 'editorial' ? 4 : 5;
  if (run.sources.length < minSources) errors.push(`${run.runId}: requires at least ${minSources} sources`);
  if (sourceClasses.size < minSourceClasses) errors.push(`${run.runId}: requires at least ${minSourceClasses} source classes`);
  if (independenceGroups.size < 3) errors.push(`${run.runId}: requires at least three independent source groups`);

  for (const claim of run.claims) {
    if (claim.status !== 'supported') errors.push(`${run.runId}: claim ${claim.id} is ${claim.status}`);
    for (const sourceId of claim.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`${run.runId}: claim ${claim.id} references missing source ${sourceId}`);
    }
  }

  if (run.status === 'validated') {
    if (run.researchPasses.length < 3) errors.push(`${run.runId}: validated runs require at least three research passes`);
    const saturationPasses = run.researchPasses.slice(-2);
    if (saturationPasses.length < 2 || saturationPasses.some((pass) => pass.materialNoveltyRate >= 0.1)) {
      errors.push(`${run.runId}: final two research passes must each add less than 10% material novelty`);
    }
    if (!run.completedAt) errors.push(`${run.runId}: validated run is missing completedAt`);
    if (!run.qa.passed || run.qa.blockers.length > 0) errors.push(`${run.runId}: independent QA did not pass cleanly`);
    if (run.qa.reviewerId === run.draftAuthor) errors.push(`${run.runId}: drafter cannot review its own work`);
    if (run.article.editorialScore < 75) errors.push(`${run.runId}: article editorial score is below 75`);
    if (run.article.evidenceConfidence < 70) errors.push(`${run.runId}: article evidence confidence is below 70`);
    if (run.article.status !== 'publication_ready') errors.push(`${run.runId}: validated run must mark its article publication_ready`);
  }
  if (run.article.status === 'publication_ready' && run.status !== 'validated') errors.push(`${run.runId}: publication_ready article requires a validated run`);

  if (['roundup', 'pairing-guide'].includes(run.contentType)) {
    if (run.candidates.length < 12) errors.push(`${run.runId}: roundups require at least 12 candidates`);
    if (run.finalists.length < 5) errors.push(`${run.runId}: roundups require at least five finalists`);
    for (const finalist of run.finalists) {
      const candidate = run.candidates.find((item) => item.id === finalist.id);
      if (!candidate) errors.push(`${run.runId}: finalist ${finalist.id} is not in the candidate field`);
      else if (JSON.stringify(candidate) !== JSON.stringify(finalist)) errors.push(`${run.runId}: finalist ${finalist.id} must exactly match its candidate record`);
      if (finalist.editorialScore < 75) errors.push(`${run.runId}: finalist ${finalist.id} editorial score is below 75`);
      if (finalist.evidenceConfidence < 70) errors.push(`${run.runId}: finalist ${finalist.id} evidence confidence is below 70`);
      if (finalist.drawbacks.length === 0) errors.push(`${run.runId}: finalist ${finalist.id} needs a documented drawback`);
      if (finalist.primarySourceIds.length === 0) errors.push(`${run.runId}: finalist ${finalist.id} needs a primary source`);
      if (finalist.independentSourceIds.length < 2) errors.push(`${run.runId}: finalist ${finalist.id} needs two independent sources`);
      const primarySources = finalist.primarySourceIds.map((id) => run.sources.find((source) => source.id === id));
      if (primarySources.some((source) => !source)) errors.push(`${run.runId}: finalist ${finalist.id} references a missing primary source`);
      if (primarySources.some((source) => source && source.sourceClass !== 'manufacturer')) errors.push(`${run.runId}: finalist ${finalist.id} primary evidence must be manufacturer material`);
      const independentSources = finalist.independentSourceIds.map((id) => run.sources.find((source) => source.id === id));
      if (independentSources.some((source) => !source)) errors.push(`${run.runId}: finalist ${finalist.id} references a missing independent source`);
      if (independentSources.some((source) => source && (source.sourceClass !== 'independent-review' || source.trustTier === 'D'))) errors.push(`${run.runId}: finalist ${finalist.id} independent evidence must be non-Tier-D reviews`);
      const independentGroups = new Set(independentSources.filter(Boolean).map((source) => source.independenceGroup));
      if (independentGroups.size < 2) errors.push(`${run.runId}: finalist ${finalist.id} needs two genuinely independent review groups`);
      if (finalist.claimIds.length < 2) errors.push(`${run.runId}: finalist ${finalist.id} needs linked benefit and drawback claims`);
      for (const claimId of finalist.claimIds) if (!claimIds.has(claimId)) errors.push(`${run.runId}: finalist ${finalist.id} references missing claim ${claimId}`);

      if (run.schemaVersion === '1.1.0') {
        const thoughtfulness = finalist.thoughtfulness;
        if (!thoughtfulness) {
          errors.push(`${run.runId}: finalist ${finalist.id} needs a thoughtfulness scorecard`);
        } else {
          const scoreParts = thoughtfulness.score;
          const scoreTotal = scoreParts.frictionSpecificity + scoreParts.selfPurchaseLogic + scoreParts.ownershipEase + scoreParts.recipientSpecificity;
          if (scoreTotal !== scoreParts.total) errors.push(`${run.runId}: finalist ${finalist.id} thoughtfulness score does not sum`);
          if (scoreParts.total < 15 || [scoreParts.frictionSpecificity, scoreParts.selfPurchaseLogic, scoreParts.ownershipEase, scoreParts.recipientSpecificity].some((score) => score < 3)) {
            errors.push(`${run.runId}: finalist ${finalist.id} thoughtfulness score is below the 15/20 gate`);
          }
          if (thoughtfulness.physicalGiftBoundary !== 'welcome_when_verified') errors.push(`${run.runId}: finalist ${finalist.id} does not clear the physical-gift boundary`);
          if (thoughtfulness.selfPurchase.reason === 'unknown') errors.push(`${run.runId}: finalist ${finalist.id} has no defensible self-purchase logic`);
          if (['medium', 'high'].includes(thoughtfulness.duplicateRisk.level) && !thoughtfulness.duplicateRisk.preGiftCheck) errors.push(`${run.runId}: finalist ${finalist.id} needs a duplicate-risk pre-gift check`);
          if (thoughtfulness.compatibilityChecks.some((check) => ['unknown', 'failed'].includes(check.status))) errors.push(`${run.runId}: finalist ${finalist.id} has unresolved compatibility`);
          const thoughtfulnessClaimIds = [
            ...thoughtfulness.frictionClaimIds,
            ...thoughtfulness.selfPurchase.claimIds,
            ...thoughtfulness.compatibilityChecks.flatMap((check) => check.claimIds)
          ];
          for (const claimId of thoughtfulnessClaimIds) if (!claimIds.has(claimId)) errors.push(`${run.runId}: finalist ${finalist.id} thoughtfulness references missing claim ${claimId}`);
          for (const claimId of thoughtfulness.frictionClaimIds) {
            const claim = run.claims.find((entry) => entry.id === claimId);
            if (claim && claim.kind !== 'recipient_friction') errors.push(`${run.runId}: finalist ${finalist.id} friction evidence must reference recipient_friction claims`);
          }
        }
      }
    }
  }

  const pairIds = new Set(runPairs.map((pair) => pair.id));
  if (pairIds.size !== runPairs.length) errors.push(`${run.runId}: pair IDs must be unique`);
  for (const pair of runPairs) {
    if (pair.anchorCandidateId === pair.companionCandidateId) errors.push(`${run.runId}: pair ${pair.id} must contain two distinct candidates`);
    const anchor = run.finalists.find((candidate) => candidate.id === pair.anchorCandidateId);
    const companion = run.finalists.find((candidate) => candidate.id === pair.companionCandidateId);
    if (!anchor || !companion) errors.push(`${run.runId}: pair ${pair.id} must use two independently qualified finalists`);
    const score = pair.score;
    const pairTotal = score.sharedCuriosity + score.complementaryRoles + score.interactionLoop + score.observableTrigger + score.independentValue + score.compatibility + score.ownershipEase;
    if (pairTotal !== score.total) errors.push(`${run.runId}: pair ${pair.id} coherence score does not sum`);
    const pairMinimum = strategy?.thoughtfulnessFramework.minimumPairCoherenceScore ?? 80;
    if (score.total < pairMinimum) errors.push(`${run.runId}: pair ${pair.id} is below the ${pairMinimum}/100 coherence gate`);
    if (pair.clutterDelta === 'adds') errors.push(`${run.runId}: pair ${pair.id} adds clutter instead of creating enough incremental utility`);
    if (pair.compatibilityChecks.some((check) => ['unknown', 'failed'].includes(check.status))) errors.push(`${run.runId}: pair ${pair.id} has unresolved compatibility`);
    for (const claimId of pair.claimIds) {
      const claim = run.claims.find((entry) => entry.id === claimId);
      if (!claim) errors.push(`${run.runId}: pair ${pair.id} references missing claim ${claimId}`);
      else if (run.schemaVersion === '1.1.0' && claim.kind !== 'pair_coherence') errors.push(`${run.runId}: pair ${pair.id} must reference pair_coherence claims`);
    }
    for (const check of pair.compatibilityChecks) for (const claimId of check.claimIds) if (!claimIds.has(claimId)) errors.push(`${run.runId}: pair ${pair.id} compatibility references missing claim ${claimId}`);
  }

  for (const link of run.affiliateLinks) {
    const program = enabledPrograms.get(link.programId);
    if (!program) {
      errors.push(`${run.runId}: affiliate program ${link.programId} is not enabled`);
      continue;
    }
    const destination = new URL(link.url);
    if (!program.allowedDomains.includes(destination.hostname) || !program.allowedDomains.includes(link.finalDomain)) {
      errors.push(`${run.runId}: affiliate link domain is not allowlisted for ${link.programId}`);
    }
    if (!link.trackingPreserved) errors.push(`${run.runId}: affiliate tracking was not preserved`);
  }

  const article = articles.get(run.article.slug);
  if (!article) {
    errors.push(`${run.runId}: article ${run.article.slug}.md is missing`);
    continue;
  }
  if (article.data.researchRun !== run.runId) errors.push(`${run.runId}: article researchRun does not match`);
  if (article.data.status !== run.article.status) errors.push(`${run.runId}: article publication status does not match the research artifact`);
  if (article.data.status === 'publication_ready' && Number(article.data.evidenceScore) < 75) errors.push(`${run.runId}: publication-ready article evidence score is below 75`);

  const products = Array.isArray(article.data.products) ? article.data.products : [];
  const paidProducts = products.filter((product) => product.affiliate === true);
  if (paidProducts.length > 0 && article.data.affiliateDisclosure !== true) errors.push(`${run.runId}: paid products require article disclosure`);
  for (const product of paidProducts) {
    if (!enabledPrograms.has(product.affiliateProgram)) errors.push(`${run.runId}: article product ${product.id} uses a disabled affiliate program`);
  }
  const articleProductIds = products.map((product) => product.id);
  const finalistIds = run.finalists.map((finalist) => finalist.id);
  if (run.contentType === 'roundup' && JSON.stringify(articleProductIds.sort()) !== JSON.stringify(finalistIds.sort())) {
    errors.push(`${run.runId}: article product IDs must exactly match finalist IDs`);
  }
  for (const product of products) {
    const finalist = run.finalists.find((item) => item.id === product.id);
    if (finalist) {
      if (product.editorialScore !== finalist.editorialScore || product.evidenceConfidence !== finalist.evidenceConfidence) errors.push(`${run.runId}: article scores differ from finalist ${product.id}`);
      if (!finalist.drawbacks.includes(product.drawback)) errors.push(`${run.runId}: article drawback differs from finalist ${product.id}`);
      if (JSON.stringify([...(product.claimIds ?? [])].sort()) !== JSON.stringify([...finalist.claimIds].sort())) errors.push(`${run.runId}: article claim IDs differ from finalist ${product.id}`);
    }
    let destination;
    try { destination = new URL(product.url); } catch { errors.push(`${run.runId}: article product ${product.id} has an invalid URL`); }
    if (destination && destination.protocol !== 'https:') errors.push(`${run.runId}: article product ${product.id} must use HTTPS`);
    if (!product.affiliate && destination && [...destination.searchParams.keys()].some((key) => /^(tag|ref|aff|affiliate|utm_|irclickid|clickid)/i.test(key))) {
      errors.push(`${run.runId}: non-affiliate product ${product.id} contains tracking parameters`);
    }
  }
  const articlePairs = Array.isArray(article.data.pairs) ? article.data.pairs : [];
  const articlePairIds = articlePairs.map((pair) => pair.id).sort();
  const reviewedPairIds = runPairs.map((pair) => pair.id).sort();
  if (JSON.stringify(articlePairIds) !== JSON.stringify(reviewedPairIds)) errors.push(`${run.runId}: article pair IDs must exactly match reviewed pairs`);
  for (const pair of articlePairs) {
    const reviewedPair = runPairs.find((entry) => entry.id === pair.id);
    if (!reviewedPair) continue;
    if (!articleProductIds.includes(pair.anchorProductId) || !articleProductIds.includes(pair.companionProductId)) errors.push(`${run.runId}: article pair ${pair.id} references a product outside the finalist set`);
    if (pair.anchorProductId !== reviewedPair.anchorCandidateId || pair.companionProductId !== reviewedPair.companionCandidateId) errors.push(`${run.runId}: article pair ${pair.id} products differ from reviewed pair`);
    if (pair.name !== reviewedPair.name || pair.whyTogether !== reviewedPair.whyTogether || pair.interactionMoment !== reviewedPair.interactionMoment) errors.push(`${run.runId}: article pair ${pair.id} editorial rationale differs from reviewed pair`);
    if (pair.preGiftCheck !== reviewedPair.preGiftCheck || pair.bundleDrawback !== reviewedPair.bundleDrawback) errors.push(`${run.runId}: article pair ${pair.id} risk language differs from reviewed pair`);
    if (Number(pair.coherenceScore) !== reviewedPair.score.total) errors.push(`${run.runId}: article pair ${pair.id} coherence score differs from reviewed pair`);
    if (JSON.stringify([...(pair.claimIds ?? [])].sort()) !== JSON.stringify([...reviewedPair.claimIds].sort())) errors.push(`${run.runId}: article pair ${pair.id} claim IDs differ from reviewed pair`);
  }
  if (run.article.evidenceMode !== 'hands_on' && /\$\d+(?:\.\d{2})?/i.test(article.body)) errors.push(`${run.runId}: desk-research article contains a time-sensitive exact price`);

  const falseExperience = impliesFirstHandExperience(article.body);
  if (falseExperience && run.article.evidenceMode !== 'hands_on') errors.push(`${run.runId}: non-hands-on article implies first-hand product experience`);
  if (run.qa.warnings.length > 0) warnings.push(...run.qa.warnings.map((warning) => `${run.runId}: ${warning}`));
}

for (const [slug, article] of articles) {
  if (article.data.status === 'publication_ready' && !seenRunIds.has(article.data.researchRun)) errors.push(`${slug}: publication-ready article has no matching research run`);
}

const socialFiles = await filesUnder(socialDir, '.json');
for (const socialFile of socialFiles) {
  let pack;
  try {
    pack = socialPackSchema.parse(JSON.parse(await fs.readFile(socialFile, 'utf8')));
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) errors.push(`${path.basename(socialFile)} ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    errors.push(`${path.basename(socialFile)}: ${error.message}`);
    continue;
  }

  if (path.basename(socialFile, '.json') !== pack.packId) errors.push(`${pack.packId}: social filename must match packId`);
  if (pack.packId !== `${pack.articleSlug}-launch`) errors.push(`${pack.packId}: packId must be derived from articleSlug`);
  const article = articles.get(pack.articleSlug);
  const run = runsById.get(pack.researchRun);
  if (!article) errors.push(`${pack.packId}: matching article is missing`);
  if (!run) errors.push(`${pack.packId}: matching research run is missing`);
  if (article && article.data.researchRun !== pack.researchRun) errors.push(`${pack.packId}: article and social pack researchRun differ`);
  if (run && run.article.slug !== pack.articleSlug) errors.push(`${pack.packId}: research run and social pack articleSlug differ`);
  const runClaimIds = new Set(run?.claims.map((claim) => claim.id) ?? []);
  const runProductIds = new Set(run?.finalists.map((product) => product.id) ?? []);
  const runPairIds = new Set((run?.pairs ?? []).map((pair) => pair.id));
  const strategyIdea = run ? strategyIdeasById.get(run.ideaId) : undefined;
  if (strategyIdea && pack.posts.length < strategyIdea.deliverables.minimumSocialAngles) errors.push(`${pack.packId}: does not meet the strategy minimum social-angle count`);

  const expectedDestination = `https://tipsforyourgifts.web.app/blog/${pack.articleSlug}`;
  const ids = new Set();
  const angles = new Set();
  const headlines = new Set();
  const copy = new Set();
  for (const post of pack.posts) {
    if (ids.has(post.id)) errors.push(`${pack.packId}: duplicate social post id ${post.id}`);
    if (angles.has(post.angle.toLowerCase())) errors.push(`${pack.packId}: duplicate social angle ${post.angle}`);
    if (headlines.has(post.headline.toLowerCase())) errors.push(`${pack.packId}: duplicate social headline ${post.headline}`);
    if (copy.has(post.copy.toLowerCase())) errors.push(`${pack.packId}: duplicate social copy in ${post.id}`);
    ids.add(post.id);
    angles.add(post.angle.toLowerCase());
    headlines.add(post.headline.toLowerCase());
    copy.add(post.copy.toLowerCase());
    if (post.destinationUrl !== expectedDestination) errors.push(`${pack.packId}: ${post.id} must link to the owned article, not a merchant`);
    if (post.status !== 'draft' && !pack.policy.externalPublishingAuthorized) errors.push(`${pack.packId}: ${post.id} cannot advance beyond draft without external publishing authorization`);
    if (post.externalPostId !== null && post.status !== 'published') errors.push(`${pack.packId}: ${post.id} has an external ID before publication`);
    if (impliesFirstHandExperience(`${post.copy} ${post.assetBrief}`)) errors.push(`${pack.packId}: ${post.id} implies unverified first-hand experience`);
    if (/\b(price|sale|discount)\s*[:=-]?\s*\$\d+/i.test(`${post.headline} ${post.copy}`)) errors.push(`${pack.packId}: ${post.id} contains a time-sensitive exact price claim`);
    for (const claimId of post.claimIds) if (!runClaimIds.has(claimId)) errors.push(`${pack.packId}: ${post.id} references unknown claim ${claimId}`);
    for (const productId of post.productIds) if (!runProductIds.has(productId)) errors.push(`${pack.packId}: ${post.id} references unknown product ${productId}`);
    for (const pairId of post.pairIds) if (!runPairIds.has(pairId)) errors.push(`${pack.packId}: ${post.id} references unknown pair ${pairId}`);
    if (run?.schemaVersion === '1.1.0' && (post.claimIds.length === 0 || post.productIds.length + post.pairIds.length === 0)) errors.push(`${pack.packId}: ${post.id} needs reviewed claim and product or pair references`);
  }
  if (pack.status !== 'draft' && !pack.policy.externalPublishingAuthorized) errors.push(`${pack.packId}: pack cannot advance beyond draft without external publishing authorization`);
  if (pack.policy.containsAffiliateLinks) errors.push(`${pack.packId}: social launch packs must drive to owned content, not affiliate destinations`);
  if (pack.posts.some((post) => post.disclosureRequired) !== pack.policy.containsAffiliateLinks) {
    errors.push(`${pack.packId}: disclosure flags do not match the affiliate-link posture`);
  }
}

for (const run of runsById.values()) {
  if (run.status !== 'validated') continue;
  const receiptPath = path.join(root, run.qa.receiptPath);
  let receipt;
  let receiptRaw;
  try {
    receiptRaw = await fs.readFile(receiptPath, 'utf8');
    receipt = reviewReceiptSchema.parse(JSON.parse(receiptRaw));
  } catch (error) {
    errors.push(`${run.runId}: independent QA receipt is missing or invalid (${error.message})`);
    continue;
  }
  if (receipt.receiptId !== `${run.runId}-qa` || receipt.runId !== run.runId || receipt.articleSlug !== run.article.slug) errors.push(`${run.runId}: QA receipt identity does not match the run`);
  if (receipt.verdict !== 'passed' || receipt.blockers.length > 0) errors.push(`${run.runId}: QA receipt did not pass cleanly`);
  if (receipt.reviewerId !== run.qa.reviewerId || receipt.reviewerId === run.draftAuthor) errors.push(`${run.runId}: QA receipt reviewer separation failed`);
  if (receipt.evidenceSha256 !== evidenceDigest(run)) errors.push(`${run.runId}: evidence changed after independent review`);
  const articlePath = path.join(blogDir, `${run.article.slug}.md`);
  if (receipt.articleSha256 !== articleDigest(await fs.readFile(articlePath))) errors.push(`${run.runId}: article changed after independent review`);
  const socialPath = path.join(socialDir, `${run.article.slug}-launch.json`);
  let expectedSocialHash = null;
  try { expectedSocialHash = sha256(await fs.readFile(socialPath)); } catch {}
  if (receipt.socialSha256 !== expectedSocialHash) errors.push(`${run.runId}: social package changed after independent review`);
}

if (errors.length > 0) fail(errors);
else {
  console.log(JSON.stringify({
    gate: 'passed',
    researchRuns: runFiles.length,
    articles: articleFiles.length,
    socialPacks: socialFiles.length,
    enabledAffiliatePrograms: enabledPrograms.size,
    warnings
  }, null, 2));
}
