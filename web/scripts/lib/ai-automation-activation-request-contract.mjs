const repository = 'lucasdmoyer/tipsforyourgifts';
const sha256Pattern = /^[a-f0-9]{64}$/;

export const aiActivationAuthorityLines = Object.freeze([
  'I reviewed the current founder-approved budget controls and credential-verification receipt bound to this exact policy digest.',
  'I authorize a review proposal that changes only the versioned AI policy from credential-verified to active; merging that exact proposal remains a separate founder decision.',
  'This may open a credential-free activation pull request only; it does not merge, call a model, start a mission, publish, authorize additional spend, or deploy Firebase.'
]);

function assertPolicySha256(value) {
  if (!sha256Pattern.test(value ?? '')) throw new Error('AI activation policy SHA-256 is invalid');
  return value;
}

function assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256 }) {
  assertPolicySha256(actualPolicySha256);
  if (policyStatus !== 'credential_verified_awaiting_activation') throw new Error('AI automation policy is not awaiting explicit activation');
  if (actualPolicySha256 !== expectedPolicySha256) throw new Error('AI automation policy changed after founder review');
}

function parseDecision(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact decision\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  if (blocks.length !== 1) throw new Error('AI activation issue must contain exactly one Exact decision JSON block');
  let decision;
  try {
    decision = JSON.parse(blocks[0]);
  } catch {
    throw new Error('AI activation Exact decision block is not valid JSON');
  }
  const expectedKeys = ['decision', 'expectedPolicySha256', 'schemaVersion'];
  if (!decision || Array.isArray(decision) || JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(expectedKeys)) throw new Error('AI activation Exact decision contains unexpected fields');
  if (decision.schemaVersion !== '1.0.0' || decision.decision !== 'propose_ai_automation_activation') throw new Error('AI activation Exact decision is invalid');
  return {
    expectedPolicySha256: assertPolicySha256(decision.expectedPolicySha256),
    confirmation: 'ACTIVATE-ai-automation'
  };
}

function assertAuthorityChecks(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n').toLowerCase();
  for (const line of aiActivationAuthorityLines) {
    if (!normalized.includes(`- [x] ${line}`.toLowerCase())) throw new Error(`AI activation authority check is missing: ${line}`);
  }
}

export function buildAiAutomationActivationIssueUrl({ expectedPolicySha256 }) {
  const policySha256 = assertPolicySha256(expectedPolicySha256);
  const decision = {
    schemaVersion: '1.0.0',
    decision: 'propose_ai_automation_activation',
    expectedPolicySha256: policySha256
  };
  const title = `[Propose AI Activation] policy ${policySha256.slice(0, 12)}`;
  const body = [
    '# Propose bounded AI editorial-team activation',
    '',
    'This packet opens a review pull request only. It does not activate the policy by itself. Activation occurs only if Lucas later reviews and merges the exact generated proposal.',
    '',
    '## Exact decision',
    '',
    '```json',
    JSON.stringify(decision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...aiActivationAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    '> Check all three boxes only after the current budget and credential receipts are visible in Studio. Submitting this issue starts no research mission and makes no model call.'
  ].join('\n');
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (url.toString().length > 12_000) throw new Error('AI activation issue packet exceeds the safe GitHub URL limit');
  return url.toString();
}

export function resolveAiAutomationActivationIssueRequest({ issue, actualPolicySha256, policyStatus }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('AI activation issue must be submitted by repository owner lucasdmoyer');
  if (!new RegExp(`^https://github\\.com/${repository.replace('/', '\\/')}/issues/[1-9]\\d*$`).test(issue?.html_url ?? '')) throw new Error('AI activation issue URL is outside the canonical repository');
  const request = parseDecision(issue.body);
  const expectedTitle = `[Propose AI Activation] policy ${request.expectedPolicySha256.slice(0, 12)}`;
  if (issue.title !== expectedTitle) throw new Error(`AI activation title must be exactly ${expectedTitle}`);
  assertAuthorityChecks(issue.body);
  assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256: request.expectedPolicySha256 });
  return { ...request, source: 'owner_issue' };
}

export function resolveAiAutomationActivationManualRequest({ expectedPolicySha256, confirmation, actualPolicySha256, policyStatus }) {
  if (confirmation !== 'ACTIVATE-ai-automation') throw new Error('AI activation confirmation is invalid');
  const policySha256 = assertPolicySha256(expectedPolicySha256);
  assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256: policySha256 });
  return { expectedPolicySha256: policySha256, confirmation, source: 'workflow_dispatch' };
}
