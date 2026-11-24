import { createHash } from 'node:crypto';

const repository = 'lucasdmoyer/tipsforyourgifts';
const runIdPattern = /^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

export const editorialSafetyDecisionAuthorityLines = Object.freeze([
  'I reviewed the exact reader language, high-risk claims, source bindings, and content digests shown in this packet.',
  'I authorize only the selected approved or rejected decision for this exact bundle; a fresh independent QA receipt is still required before publication.',
  'This may open a founder-safety decision pull request only; it does not merge, publish, activate affiliate links, post social content, send email, authorize spend, or deploy Firebase.'
]);

function assertRunId(value) {
  if (!runIdPattern.test(value ?? '')) throw new Error('Editorial safety run ID is invalid');
  return value;
}

function assertSha256(value, label) {
  if (!sha256Pattern.test(value ?? '')) throw new Error(`${label} SHA-256 is invalid`);
  return value;
}

function assertDecision(value) {
  if (!['approved', 'rejected'].includes(value)) throw new Error('Editorial safety decision must be approved or rejected');
  return value;
}

export function hashEditorialSafetyClaims(highRiskClaims) {
  if (!Array.isArray(highRiskClaims) || highRiskClaims.length === 0) throw new Error('Editorial safety packet requires at least one high-risk claim');
  return createHash('sha256').update(JSON.stringify(highRiskClaims), 'utf8').digest('hex');
}

export function parseEditorialSafetyExactDecision(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact decision\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  if (blocks.length !== 1) throw new Error('Editorial safety issue must contain exactly one Exact decision JSON block');
  let decision;
  try { decision = JSON.parse(blocks[0]); } catch { throw new Error('Editorial safety Exact decision block is not valid JSON'); }
  const expectedKeys = ['decision', 'expectedArticleSha256', 'expectedHighRiskClaimsSha256', 'expectedRunSha256', 'expectedSocialSha256', 'runId', 'schemaVersion'];
  if (!decision || Array.isArray(decision) || JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error('Editorial safety Exact decision contains unexpected fields');
  }
  if (decision.schemaVersion !== '1.0.0') throw new Error('Editorial safety decision schema version is unsupported');
  return {
    runId: assertRunId(decision.runId),
    decision: assertDecision(decision.decision),
    expectedRunSha256: assertSha256(decision.expectedRunSha256, 'Editorial safety run'),
    expectedArticleSha256: assertSha256(decision.expectedArticleSha256, 'Editorial safety article'),
    expectedSocialSha256: decision.expectedSocialSha256 === null ? null : assertSha256(decision.expectedSocialSha256, 'Editorial safety social pack'),
    expectedHighRiskClaimsSha256: assertSha256(decision.expectedHighRiskClaimsSha256, 'Editorial safety claim set')
  };
}

function assertAuthorityChecks(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n').toLowerCase();
  for (const line of editorialSafetyDecisionAuthorityLines) {
    if (!normalized.includes(`- [x] ${line}`.toLowerCase())) throw new Error(`Editorial safety authority check is missing: ${line}`);
  }
}

function assertCurrentState({ request, review }) {
  if (review.runId !== request.runId) throw new Error('Editorial safety request does not match the current review bundle');
  if (review.sourceSha256.run !== request.expectedRunSha256) throw new Error('Editorial safety research run changed after founder review');
  if (review.sourceSha256.article !== request.expectedArticleSha256) throw new Error('Editorial safety article changed after founder review');
  if (review.sourceSha256.social !== request.expectedSocialSha256) throw new Error('Editorial safety social pack changed after founder review');
  if (hashEditorialSafetyClaims(review.highRiskClaims) !== request.expectedHighRiskClaimsSha256) throw new Error('Editorial safety high-risk claims changed after founder review');
  if (!['approval_required', 'stale'].includes(review.founderSafetyReviewStatus)) throw new Error('Editorial safety bundle does not accept a new founder decision on its current bytes');
}

export function buildEditorialSafetyDecisionIssueUrl({ review, decision }) {
  const safeDecision = assertDecision(decision);
  const exactDecision = {
    schemaVersion: '1.0.0',
    decision: safeDecision,
    runId: assertRunId(review.runId),
    expectedRunSha256: assertSha256(review.sourceSha256.run, 'Editorial safety run'),
    expectedArticleSha256: assertSha256(review.sourceSha256.article, 'Editorial safety article'),
    expectedSocialSha256: review.sourceSha256.social === null ? null : assertSha256(review.sourceSha256.social, 'Editorial safety social pack'),
    expectedHighRiskClaimsSha256: hashEditorialSafetyClaims(review.highRiskClaims)
  };
  const decisionVerb = safeDecision === 'approved' ? 'Approve' : 'Reject';
  const title = `[Editorial Safety Decision] ${review.runId} ${safeDecision}`;
  const claimLines = review.highRiskClaims.flatMap((claim) => [
    `### ${claim.id}`,
    '',
    claim.text,
    '',
    `Sources: ${claim.sourceIds.join(', ')}`,
    ''
  ]);
  const body = [
    `# ${decisionVerb} the exact editorial safety language`,
    '',
    `Lucas, this packet is bound to one exact research bundle and ${review.highRiskClaims.length} high-risk claim${review.highRiskClaims.length === 1 ? '' : 's'}. Read the language below, check all three authority boxes, and submit only if the selected ${safeDecision} decision is correct. The protected workflow may open a review pull request; it cannot merge or publish it.`,
    '',
    '## Bundle identity',
    '',
    `- **Article:** ${review.articleSlug}`,
    `- **Research run:** ${review.runId}`,
    `- **Run SHA-256:** ${review.sourceSha256.run}`,
    `- **Article SHA-256:** ${review.sourceSha256.article}`,
    `- **Social pack SHA-256:** ${review.sourceSha256.social ?? 'none'}`,
    `- **High-risk claim-set SHA-256:** ${exactDecision.expectedHighRiskClaimsSha256}`,
    '',
    '## Exact high-risk claims',
    '',
    ...claimLines,
    '## Exact decision',
    '',
    '```json',
    JSON.stringify(exactDecision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...editorialSafetyDecisionAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    '> Approval does not certify the drafting desk. A separate independent editor must still issue a clean receipt on these exact bytes before the article can advance.'
  ].join('\n');
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (url.toString().length > 12_000) throw new Error('Editorial safety issue packet exceeds the safe GitHub URL limit');
  return url.toString();
}

export function resolveEditorialSafetyDecisionIssue({ issue, review }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('Editorial safety issue must be submitted by repository owner lucasdmoyer');
  if (!new RegExp(`^https://github\\.com/${repository.replace('/', '\\/')}/issues/[1-9]\\d*$`).test(issue?.html_url ?? '')) throw new Error('Editorial safety issue URL is outside the canonical repository');
  const request = parseEditorialSafetyExactDecision(issue.body);
  const expectedTitle = `[Editorial Safety Decision] ${request.runId} ${request.decision}`;
  if (issue.title !== expectedTitle) throw new Error(`Editorial safety title must be exactly ${expectedTitle}`);
  assertAuthorityChecks(issue.body);
  assertCurrentState({ request, review });
  return { ...request, confirmation: `REVIEW-${request.runId}-${request.decision}`, source: 'owner_issue' };
}

export function resolveEditorialSafetyDecisionManual({ runId, decision, confirmation, review }) {
  const request = {
    runId: assertRunId(runId),
    decision: assertDecision(decision),
    expectedRunSha256: review.sourceSha256.run,
    expectedArticleSha256: review.sourceSha256.article,
    expectedSocialSha256: review.sourceSha256.social,
    expectedHighRiskClaimsSha256: hashEditorialSafetyClaims(review.highRiskClaims)
  };
  if (confirmation !== `REVIEW-${request.runId}-${request.decision}`) throw new Error('Editorial safety manual confirmation is invalid');
  assertCurrentState({ request, review });
  return { ...request, confirmation, source: 'workflow_dispatch' };
}
