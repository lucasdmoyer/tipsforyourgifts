const repository = 'lucasdmoyer/tipsforyourgifts';
const sha256Pattern = /^[a-f0-9]{64}$/;

export const aiCredentialEnvironment = 'ai-automation-credential';
export const aiCredentialSecretName = 'OPENAI_API_KEY';
export const aiCredentialEndpoint = 'https://api.openai.com/v1/models';
export const aiCredentialEnvironmentSettingsUrl = 'https://github.com/lucasdmoyer/tipsforyourgifts/settings/environments';

export const aiCredentialAuthorityLines = Object.freeze([
  'I stored a dedicated OpenAI project key only as the protected GitHub secret OPENAI_API_KEY available to the ai-automation-credential environment.',
  'I authorize one authentication request to the documented models endpoint; the response body is discarded and no model is called.',
  'This verification may open a credential-free receipt pull request only; it does not reveal the key, activate automation, merge, publish, authorize spend, or deploy Firebase.'
]);

function assertPolicySha256(value) {
  if (!sha256Pattern.test(value ?? '')) throw new Error('AI credential policy SHA-256 is invalid');
  return value;
}

function assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256 }) {
  assertPolicySha256(actualPolicySha256);
  if (policyStatus !== 'budget_approved_awaiting_credential') throw new Error('AI automation policy is not awaiting credential verification');
  if (actualPolicySha256 !== expectedPolicySha256) throw new Error('AI automation policy changed after founder review');
}

function parseDecision(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact decision\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  if (blocks.length !== 1) throw new Error('AI credential issue must contain exactly one Exact decision JSON block');
  let decision;
  try {
    decision = JSON.parse(blocks[0]);
  } catch {
    throw new Error('AI credential Exact decision block is not valid JSON');
  }
  const expectedKeys = ['decision', 'endpoint', 'environment', 'expectedPolicySha256', 'method', 'schemaVersion', 'secretName'];
  if (!decision || Array.isArray(decision) || JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(expectedKeys)) throw new Error('AI credential Exact decision contains unexpected fields');
  if (
    decision.schemaVersion !== '1.0.0' ||
    decision.decision !== 'verify_ai_automation_credential' ||
    decision.secretName !== aiCredentialSecretName ||
    decision.environment !== aiCredentialEnvironment ||
    decision.method !== 'openai_models_endpoint' ||
    decision.endpoint !== aiCredentialEndpoint
  ) throw new Error('AI credential Exact decision is invalid');
  return {
    expectedPolicySha256: assertPolicySha256(decision.expectedPolicySha256),
    confirmation: 'VERIFY-ai-automation-credential'
  };
}

function assertAuthorityChecks(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n').toLowerCase();
  for (const line of aiCredentialAuthorityLines) {
    if (!normalized.includes(`- [x] ${line}`.toLowerCase())) throw new Error(`AI credential authority check is missing: ${line}`);
  }
}

export function buildAiAutomationCredentialIssueUrl({ expectedPolicySha256 }) {
  const policySha256 = assertPolicySha256(expectedPolicySha256);
  const decision = {
    schemaVersion: '1.0.0',
    decision: 'verify_ai_automation_credential',
    expectedPolicySha256: policySha256,
    secretName: aiCredentialSecretName,
    environment: aiCredentialEnvironment,
    method: 'openai_models_endpoint',
    endpoint: aiCredentialEndpoint
  };
  const title = `[Verify AI Credential] policy ${policySha256.slice(0, 12)}`;
  const body = [
    '# Verify the dedicated AI editorial-team credential',
    '',
    `Before submitting, open ${aiCredentialEnvironmentSettingsUrl}, select the **${aiCredentialEnvironment}** environment, and add or rotate the **${aiCredentialSecretName}** secret. Never paste the key into this issue, a prompt, a command, or a repository file.`,
    '',
    'The isolated verifier will make one authentication request, discard the response body, and produce a credential-free receipt. It checks out and runs no repository code.',
    '',
    '## Exact decision',
    '',
    '```json',
    JSON.stringify(decision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...aiCredentialAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    '> Check all three boxes only after the protected secret exists. Submitting this issue does not activate the AI policy or start a research mission.'
  ].join('\n');
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (url.toString().length > 12_000) throw new Error('AI credential issue packet exceeds the safe GitHub URL limit');
  return url.toString();
}

export function resolveAiAutomationCredentialIssueRequest({ issue, actualPolicySha256, policyStatus }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('AI credential issue must be submitted by repository owner lucasdmoyer');
  if (!new RegExp(`^https://github\\.com/${repository.replace('/', '\\/')}/issues/[1-9]\\d*$`).test(issue?.html_url ?? '')) throw new Error('AI credential issue URL is outside the canonical repository');
  const request = parseDecision(issue.body);
  const expectedTitle = `[Verify AI Credential] policy ${request.expectedPolicySha256.slice(0, 12)}`;
  if (issue.title !== expectedTitle) throw new Error(`AI credential title must be exactly ${expectedTitle}`);
  assertAuthorityChecks(issue.body);
  assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256: request.expectedPolicySha256 });
  return { ...request, source: 'owner_issue' };
}

export function resolveAiAutomationCredentialManualRequest({ expectedPolicySha256, confirmation, actualPolicySha256, policyStatus }) {
  if (confirmation !== 'VERIFY-ai-automation-credential') throw new Error('AI credential confirmation is invalid');
  const policySha256 = assertPolicySha256(expectedPolicySha256);
  assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256: policySha256 });
  return { expectedPolicySha256: policySha256, confirmation, source: 'workflow_dispatch' };
}
