export type FounderBriefMode = 'recipient_friction' | 'coherent_pair';

export interface FounderBriefDraft {
  mode: FounderBriefMode;
  title: string;
  audience: string;
  occasion: string;
  budget: string;
  geography: string;
  observedFriction: string;
  selfPurchaseGap: string;
  fitSignals: string;
  rejectionConditions: string;
  desiredOutcome: string;
  exclusions: string;
  pairAnchor: string;
  pairCompanion: string;
  pairInteraction: string;
  compatibilityChecks: string;
  authorityConfirmed: boolean;
  noSensitiveDataConfirmed: boolean;
}

export interface FounderBriefCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface FounderBriefAssessment {
  checks: FounderBriefCheck[];
  passed: number;
  total: number;
  ready: boolean;
  missing: string[];
  credentialLikeTextDetected: boolean;
}

export const EMPTY_FOUNDER_BRIEF: FounderBriefDraft = {
  mode: 'recipient_friction',
  title: '',
  audience: '',
  occasion: '',
  budget: '',
  geography: 'United States',
  observedFriction: '',
  selfPurchaseGap: '',
  fitSignals: '',
  rejectionConditions: '',
  desiredOutcome: '',
  exclusions: '',
  pairAnchor: '',
  pairCompanion: '',
  pairInteraction: '',
  compatibilityChecks: '',
  authorityConfirmed: false,
  noSensitiveDataConfirmed: false
};

const credentialPattern = /(?:-----BEGIN [A-Z ]+ PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|(?:api[_ -]?key|password|secret|token)\s*[:=]\s*\S{8,})/i;

function paragraph(value: string) {
  return value.replaceAll('\r', '').trim().replace(/\n{3,}/g, '\n\n');
}

function singleLine(value: string) {
  return paragraph(value).replace(/\s+/g, ' ');
}

export function briefList(value: string) {
  return [...new Set(paragraph(value).split('\n').map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean))];
}

export function containsCredentialLikeText(draft: FounderBriefDraft) {
  return Object.entries(draft)
    .filter(([, value]) => typeof value === 'string')
    .some(([, value]) => credentialPattern.test(value as string));
}

export function assessFounderBrief(draft: FounderBriefDraft): FounderBriefAssessment {
  const fitSignals = briefList(draft.fitSignals);
  const rejectionConditions = briefList(draft.rejectionConditions);
  const compatibilityChecks = briefList(draft.compatibilityChecks);
  const credentialLikeTextDetected = containsCredentialLikeText(draft);
  const textLength = Object.values(draft).filter((value) => typeof value === 'string').reduce((total, value) => total + (value as string).length, 0);
  const checks: FounderBriefCheck[] = [
    { id: 'direction', label: 'Specific strategic direction', passed: singleLine(draft.title).length >= 8 },
    { id: 'audience', label: 'Named recipient or audience', passed: singleLine(draft.audience).length >= 6 },
    { id: 'occasion', label: 'Occasion and timing', passed: singleLine(draft.occasion).length >= 6 },
    { id: 'budget', label: 'Budget boundary', passed: singleLine(draft.budget).length >= 3 },
    { id: 'friction', label: 'Observed workaround or recurring friction', passed: paragraph(draft.observedFriction).length >= 24 },
    { id: 'self-purchase', label: 'Defensible self-purchase gap', passed: paragraph(draft.selfPurchaseGap).length >= 24 },
    { id: 'fit', label: 'At least two proof-of-fit signals', passed: fitSignals.length >= 2 },
    { id: 'rejection', label: 'At least two rejection conditions', passed: rejectionConditions.length >= 2 },
    { id: 'outcome', label: 'Measurable reader or business outcome', passed: paragraph(draft.desiredOutcome).length >= 12 },
    { id: 'bounded', label: 'Brief fits the bounded GitHub handoff', passed: textLength <= 5000 },
    { id: 'authority', label: 'Proposal-only authority acknowledged', passed: draft.authorityConfirmed },
    { id: 'sensitive-data', label: 'No secrets or private data confirmed', passed: draft.noSensitiveDataConfirmed && !credentialLikeTextDetected }
  ];
  if (draft.mode === 'coherent_pair') {
    checks.splice(9, 0,
      { id: 'pair-roles', label: 'Two gifts with different roles', passed: singleLine(draft.pairAnchor).length >= 4 && singleLine(draft.pairCompanion).length >= 4 && singleLine(draft.pairAnchor).toLowerCase() !== singleLine(draft.pairCompanion).toLowerCase() },
      { id: 'pair-interaction', label: 'One concrete interaction moment', passed: paragraph(draft.pairInteraction).length >= 24 },
      { id: 'pair-compatibility', label: 'At least two compatibility checks', passed: compatibilityChecks.length >= 2 }
    );
  }
  const passed = checks.filter((check) => check.passed).length;
  return {
    checks,
    passed,
    total: checks.length,
    ready: passed === checks.length,
    missing: checks.filter((check) => !check.passed).map((check) => check.label),
    credentialLikeTextDetected
  };
}

function listMarkdown(value: string) {
  const items = briefList(value);
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- Not specified';
}

export function buildFounderBriefMarkdown(draft: FounderBriefDraft) {
  const sections = [
    '## Strategic direction',
    singleLine(draft.title),
    '',
    '## Recipient, occasion, and boundaries',
    `- **Audience:** ${singleLine(draft.audience)}`,
    `- **Occasion and timing:** ${singleLine(draft.occasion)}`,
    `- **Budget:** ${singleLine(draft.budget)}`,
    `- **Geography:** ${singleLine(draft.geography) || 'Not specified'}`,
    '',
    '## What I noticed',
    paragraph(draft.observedFriction),
    '',
    '## Why they postpone buying the improvement',
    paragraph(draft.selfPurchaseGap),
    '',
    '## Proof-of-fit signals the research must test',
    listMarkdown(draft.fitSignals),
    '',
    '## Reject the idea when',
    listMarkdown(draft.rejectionConditions)
  ];
  if (draft.mode === 'coherent_pair') {
    sections.push(
      '',
      '## Proposed gift pair',
      `- **Anchor:** ${singleLine(draft.pairAnchor)}`,
      `- **Companion:** ${singleLine(draft.pairCompanion)}`,
      `- **Different roles and interaction:** ${paragraph(draft.pairInteraction)}`,
      '',
      '### Compatibility, ownership, and clutter checks',
      listMarkdown(draft.compatibilityChecks)
    );
  }
  sections.push(
    '',
    '## Exclusions and guardrails',
    paragraph(draft.exclusions) || 'No additional exclusions supplied; repository safety and editorial policies still apply.',
    '',
    '## Desired outcome',
    paragraph(draft.desiredOutcome),
    '',
    '## Authority boundary',
    '- [x] This issue authorizes only one proposed strategy brief. Separate founder approval is required before research.',
    '- [x] This issue does not authorize deployment, account creation, affiliate enrollment, paid spend, credential use, or social publication.',
    '- [x] I included no credentials, tracking identifiers, private customer data, or private-group content.'
  );
  return `${sections.join('\n')}\n`;
}

export function buildStrategyIssueUrl(draft: FounderBriefDraft) {
  if (!assessFounderBrief(draft).ready) return null;
  const params = new URLSearchParams({
    title: `[Strategy] ${singleLine(draft.title).slice(0, 180)}`,
    body: buildFounderBriefMarkdown(draft),
    labels: 'strategy'
  });
  const url = `https://github.com/lucasdmoyer/tipsforyourgifts/issues/new?${params.toString()}`;
  return url.length <= 12_000 ? url : null;
}
