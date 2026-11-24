const repository = 'lucasdmoyer/tipsforyourgifts';
const sha256Pattern = /^[a-f0-9]{64}$/;
const candidateIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const affiliateLinkApprovalAuthorityLines = Object.freeze([
  'I reviewed the exact paid destination, candidate digest, and clean independent review digest shown in this packet.',
  'I authorize one review proposal for this exact paid-link overlay; product order, editorial copy, scores, and pairings must remain unchanged.',
  'This may open a founder-approval pull request only; it does not merge, expand affiliate scope, deploy Firebase, or authorize production.'
]);

function assertCandidateId(value) {
  if (!candidateIdPattern.test(value ?? '')) throw new Error('Affiliate candidate ID is invalid');
  return value;
}

function assertSha256(value, label) {
  if (!sha256Pattern.test(value ?? '')) throw new Error(`${label} SHA-256 is invalid`);
  return value;
}

function assertApprovalState({ state, candidateId, expectedCandidateSha256, expectedReviewSha256 }) {
  const candidate = state.candidates.find((record) => record.data.candidateId === candidateId);
  if (!candidate) throw new Error('Affiliate candidate is not present in the validated repository state');
  if (candidate.sha256 !== expectedCandidateSha256) throw new Error('Affiliate candidate changed after founder review');
  const review = state.reviews.find((record) => record.data.candidateId === candidateId);
  if (!review || review.data.verdict !== 'passed') throw new Error('Affiliate candidate does not have a clean independent review');
  if (review.sha256 !== expectedReviewSha256) throw new Error('Affiliate review changed after founder review');
  if (state.approvals.some((record) => record.data.candidateId === candidateId)) throw new Error('Affiliate candidate already has a founder approval');
  return { candidate, review };
}

function parseDecision(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact decision\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  if (blocks.length !== 1) throw new Error('Affiliate approval issue must contain exactly one Exact decision JSON block');
  let decision;
  try { decision = JSON.parse(blocks[0]); } catch { throw new Error('Affiliate approval Exact decision block is not valid JSON'); }
  const expectedKeys = ['candidateId', 'decision', 'expectedCandidateSha256', 'expectedReviewSha256', 'schemaVersion'];
  if (!decision || Array.isArray(decision) || JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(expectedKeys)) throw new Error('Affiliate approval Exact decision contains unexpected fields');
  if (decision.schemaVersion !== '1.0.0' || decision.decision !== 'approve_affiliate_link') throw new Error('Affiliate approval Exact decision is invalid');
  return {
    candidateId: assertCandidateId(decision.candidateId),
    expectedCandidateSha256: assertSha256(decision.expectedCandidateSha256, 'Affiliate candidate'),
    expectedReviewSha256: assertSha256(decision.expectedReviewSha256, 'Affiliate review'),
    confirmation: `APPROVE-${decision.candidateId}`
  };
}

function assertAuthorityChecks(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n').toLowerCase();
  for (const line of affiliateLinkApprovalAuthorityLines) {
    if (!normalized.includes(`- [x] ${line}`.toLowerCase())) throw new Error(`Affiliate approval authority check is missing: ${line}`);
  }
}

export function buildAffiliateLinkApprovalIssueUrl({ candidate, review }) {
  if (review.data.verdict !== 'passed' || review.data.candidateId !== candidate.data.candidateId || review.data.candidateSha256 !== candidate.sha256) {
    throw new Error('Affiliate approval packet requires a clean review bound to the exact candidate');
  }
  const decision = {
    schemaVersion: '1.0.0',
    decision: 'approve_affiliate_link',
    candidateId: candidate.data.candidateId,
    expectedCandidateSha256: candidate.sha256,
    expectedReviewSha256: review.sha256
  };
  const title = `[Approve Affiliate Link] ${candidate.data.candidateId}`;
  const body = [
    '# Approve one independently reviewed paid link',
    '',
    'Lucas, this packet is bound to one exact candidate and one clean independent evidence receipt. Check the destination and evidence below, check all three authority boxes, then submit. The protected workflow will open a review pull request; it will not merge or deploy it.',
    '',
    '## Product and destination',
    '',
    `- **Article:** ${candidate.data.articleSlug}`,
    `- **Product:** ${candidate.data.productId}`,
    `- **Program:** ${candidate.data.programId}, revision ${candidate.data.programRevision}`,
    `- **Paid destination:** ${candidate.data.destination.paidUrl}`,
    `- **Resolved destination observed by reviewer:** ${review.data.destination.resolvedUrl}`,
    `- **Purchase action observed:** ${review.data.availability.purchaseActionLabel}`,
    `- **Candidate SHA-256:** ${candidate.sha256}`,
    `- **Independent review SHA-256:** ${review.sha256}`,
    '',
    '## Exact decision',
    '',
    '```json',
    JSON.stringify(decision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...affiliateLinkApprovalAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    '> Submit only if the exact destination and review are acceptable. A later exact-commit Firebase preview and separate production approval remain mandatory.'
  ].join('\n');
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (url.toString().length > 12_000) throw new Error('Affiliate approval issue packet exceeds the safe GitHub URL limit');
  return url.toString();
}

export function resolveAffiliateLinkApprovalIssueRequest({ issue, state }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('Affiliate approval issue must be submitted by repository owner lucasdmoyer');
  if (!new RegExp(`^https://github\\.com/${repository.replace('/', '\\/')}/issues/[1-9]\\d*$`).test(issue?.html_url ?? '')) throw new Error('Affiliate approval issue URL is outside the canonical repository');
  const request = parseDecision(issue.body);
  const expectedTitle = `[Approve Affiliate Link] ${request.candidateId}`;
  if (issue.title !== expectedTitle) throw new Error(`Affiliate approval title must be exactly ${expectedTitle}`);
  assertAuthorityChecks(issue.body);
  assertApprovalState({ state, ...request });
  return { ...request, source: 'owner_issue' };
}

export function resolveAffiliateLinkApprovalManualRequest({ candidateId, expectedCandidateSha256, expectedReviewSha256, confirmation, state }) {
  const request = {
    candidateId: assertCandidateId(candidateId),
    expectedCandidateSha256: assertSha256(expectedCandidateSha256, 'Affiliate candidate'),
    expectedReviewSha256: assertSha256(expectedReviewSha256, 'Affiliate review'),
    confirmation
  };
  if (confirmation !== `APPROVE-${request.candidateId}`) throw new Error('Affiliate approval confirmation is invalid');
  assertApprovalState({ state, ...request });
  return { ...request, source: 'workflow_dispatch' };
}
