const repository = 'lucasdmoyer/tipsforyourgifts';
const sha256Pattern = /^[a-f0-9]{64}$/;
const budgetTextPattern = /^(?:0\.\d{1,2}|[1-9]\d{0,4}(?:\.\d{1,2})?)$/;

export const defaultAiBudgetEvidenceUrl = 'https://platform.openai.com/settings/organization/limits';

export const aiBudgetAuthorityLines = Object.freeze([
  'I set this exact monthly hard limit and earlier alert in the dedicated OpenAI project before submitting.',
  'I confirm hard-limit enforcement is enabled and understand that delayed reporting may allow a small overage.',
  'This records a review proposal only; it does not add a credential, call a model, activate automation, merge, publish, authorize spend, or deploy Firebase.'
]);

function assertPolicySha256(value) {
  if (!sha256Pattern.test(value ?? '')) throw new Error('AI budget policy SHA-256 is invalid');
  return value;
}

function assertBudgetText(value, label) {
  const text = String(value ?? '');
  if (!budgetTextPattern.test(text)) throw new Error(`${label} must be a positive USD amount with at most two decimal places`);
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) throw new Error(`${label} must be greater than zero and no more than 10000`);
  return { text, amount };
}

function assertBudgetPair(monthlyBudgetUsd, alertThresholdUsd) {
  const monthly = assertBudgetText(monthlyBudgetUsd, 'monthlyBudgetUsd');
  const alert = assertBudgetText(alertThresholdUsd, 'alertThresholdUsd');
  if (alert.amount >= monthly.amount) throw new Error('alertThresholdUsd must be lower than monthlyBudgetUsd');
  return { monthlyBudgetUsd: monthly.text, alertThresholdUsd: alert.text };
}

function assertPlatformEvidenceUrl(value) {
  let url;
  try {
    url = new URL(value ?? '');
  } catch {
    throw new Error('AI budget platform evidence URL is invalid');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'platform.openai.com') throw new Error('AI budget platform evidence must use HTTPS on platform.openai.com');
  if (url.username || url.password || url.search || url.hash || !/^\/settings\/organization(?:\/[a-z0-9-]+)*\/?$/.test(url.pathname)) {
    throw new Error('AI budget platform evidence must be a credential-free organization settings path');
  }
  return url.toString();
}

function assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256 }) {
  assertPolicySha256(actualPolicySha256);
  if (policyStatus !== 'awaiting_founder_platform_budget') throw new Error('AI automation policy is not awaiting founder budget approval');
  if (actualPolicySha256 !== expectedPolicySha256) throw new Error('AI automation policy changed after founder review');
}

function parseDecision(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact decision\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  if (blocks.length !== 1) throw new Error('AI budget issue must contain exactly one Exact decision JSON block');
  let decision;
  try {
    decision = JSON.parse(blocks[0]);
  } catch {
    throw new Error('AI budget Exact decision block is not valid JSON');
  }
  const expectedKeys = ['alertThresholdUsd', 'decision', 'expectedPolicySha256', 'hardLimitEnabled', 'monthlyBudgetUsd', 'platformEvidenceUrl', 'schemaVersion'];
  if (!decision || Array.isArray(decision) || JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(expectedKeys)) throw new Error('AI budget Exact decision contains unexpected fields');
  if (decision.schemaVersion !== '1.0.0' || decision.decision !== 'record_ai_automation_budget' || decision.hardLimitEnabled !== true) throw new Error('AI budget Exact decision is invalid');
  const expectedPolicySha256 = assertPolicySha256(decision.expectedPolicySha256);
  const amounts = assertBudgetPair(decision.monthlyBudgetUsd, decision.alertThresholdUsd);
  return {
    expectedPolicySha256,
    ...amounts,
    hardLimitEnabled: 'true',
    platformEvidenceUrl: assertPlatformEvidenceUrl(decision.platformEvidenceUrl),
    confirmation: 'CONFIGURE-ai-automation-budget'
  };
}

function assertAuthorityChecks(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n').toLowerCase();
  for (const line of aiBudgetAuthorityLines) {
    if (!normalized.includes(`- [x] ${line}`.toLowerCase())) throw new Error(`AI budget authority check is missing: ${line}`);
  }
}

export function buildAiAutomationBudgetIssueUrl({ expectedPolicySha256, monthlyBudgetUsd, alertThresholdUsd, platformEvidenceUrl = defaultAiBudgetEvidenceUrl }) {
  const policySha256 = assertPolicySha256(expectedPolicySha256);
  const amounts = assertBudgetPair(monthlyBudgetUsd, alertThresholdUsd);
  const evidenceUrl = assertPlatformEvidenceUrl(platformEvidenceUrl);
  const decision = {
    schemaVersion: '1.0.0',
    decision: 'record_ai_automation_budget',
    expectedPolicySha256: policySha256,
    monthlyBudgetUsd: Number(amounts.monthlyBudgetUsd),
    hardLimitEnabled: true,
    alertThresholdUsd: Number(amounts.alertThresholdUsd),
    platformEvidenceUrl: evidenceUrl
  };
  const title = `[Configure AI Budget] policy ${policySha256.slice(0, 12)}`;
  const body = [
    '# Record the AI editorial team budget boundary',
    '',
    'Before submitting, open the dedicated OpenAI project settings and set the exact hard limit and earlier alert below. This issue records Lucas’s attestation in a review pull request; it does not configure OpenAI for him.',
    '',
    `- **Monthly hard limit:** $${amounts.monthlyBudgetUsd}`,
    `- **Earlier alert:** $${amounts.alertThresholdUsd}`,
    '- **Hard-limit enforcement:** required',
    `- **Credential-free settings path:** ${evidenceUrl}`,
    '',
    '## Exact decision',
    '',
    '```json',
    JSON.stringify(decision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...aiBudgetAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    '> Check all three boxes only after the external controls are real. The protected workflow will verify this exact policy digest before opening a pull request.'
  ].join('\n');
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (url.toString().length > 12_000) throw new Error('AI budget issue packet exceeds the safe GitHub URL limit');
  return url.toString();
}

export function resolveAiAutomationBudgetIssueRequest({ issue, actualPolicySha256, policyStatus }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('AI budget issue must be submitted by repository owner lucasdmoyer');
  if (!new RegExp(`^https://github\\.com/${repository.replace('/', '\\/')}/issues/[1-9]\\d*$`).test(issue?.html_url ?? '')) throw new Error('AI budget issue URL is outside the canonical repository');
  const request = parseDecision(issue.body);
  const expectedTitle = `[Configure AI Budget] policy ${request.expectedPolicySha256.slice(0, 12)}`;
  if (issue.title !== expectedTitle) throw new Error(`AI budget title must be exactly ${expectedTitle}`);
  assertAuthorityChecks(issue.body);
  assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256: request.expectedPolicySha256 });
  return { ...request, source: 'owner_issue' };
}

export function resolveAiAutomationBudgetManualRequest({ expectedPolicySha256, monthlyBudgetUsd, hardLimitEnabled, alertThresholdUsd, platformEvidenceUrl, confirmation, actualPolicySha256, policyStatus }) {
  if (hardLimitEnabled !== 'true') throw new Error('AI budget hard-limit enforcement must be true');
  if (confirmation !== 'CONFIGURE-ai-automation-budget') throw new Error('AI budget confirmation is invalid');
  const policySha256 = assertPolicySha256(expectedPolicySha256);
  const amounts = assertBudgetPair(monthlyBudgetUsd, alertThresholdUsd);
  assertCurrentPolicy({ actualPolicySha256, policyStatus, expectedPolicySha256: policySha256 });
  return {
    expectedPolicySha256: policySha256,
    ...amounts,
    hardLimitEnabled: 'true',
    platformEvidenceUrl: assertPlatformEvidenceUrl(platformEvidenceUrl),
    confirmation,
    source: 'workflow_dispatch'
  };
}
