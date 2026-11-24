export interface FounderScoutDirectionDraft {
  direction: string;
  audience: string;
  observedSignal: string;
  boundaries: string;
  authorityConfirmed: boolean;
  noSensitiveDataConfirmed: boolean;
}

export interface FounderScoutDirectionCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface FounderScoutDirectionAssessment {
  checks: FounderScoutDirectionCheck[];
  passed: number;
  total: number;
  ready: boolean;
  credentialLikeTextDetected: boolean;
}

export const EMPTY_FOUNDER_SCOUT_DIRECTION: FounderScoutDirectionDraft = {
  direction: '',
  audience: '',
  observedSignal: '',
  boundaries: '',
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

export function containsScoutCredentialLikeText(draft: FounderScoutDirectionDraft) {
  return [draft.direction, draft.audience, draft.observedSignal, draft.boundaries].some((value) => credentialPattern.test(value));
}

export function assessFounderScoutDirection(draft: FounderScoutDirectionDraft): FounderScoutDirectionAssessment {
  const credentialLikeTextDetected = containsScoutCredentialLikeText(draft);
  const textLength = [draft.direction, draft.audience, draft.observedSignal, draft.boundaries].reduce((total, value) => total + value.length, 0);
  const checks: FounderScoutDirectionCheck[] = [
    { id: 'direction', label: 'A clear direction', passed: singleLine(draft.direction).length >= 8 },
    { id: 'audience', label: 'A recipient or audience', passed: singleLine(draft.audience).length >= 6 },
    { id: 'signal', label: 'One observation or hunch to investigate', passed: paragraph(draft.observedSignal).length >= 12 },
    { id: 'bounded', label: 'A bounded public-research handoff', passed: textLength <= 3000 },
    { id: 'authority', label: 'Proposal-only authority acknowledged', passed: draft.authorityConfirmed },
    { id: 'sensitive-data', label: 'No secrets or private data confirmed', passed: draft.noSensitiveDataConfirmed && !credentialLikeTextDetected }
  ];
  const passed = checks.filter((check) => check.passed).length;
  return { checks, passed, total: checks.length, ready: passed === checks.length, credentialLikeTextDetected };
}

export function buildFounderScoutDirectionMarkdown(draft: FounderScoutDirectionDraft) {
  return [
    '## Founder direction',
    singleLine(draft.direction),
    '',
    '## Recipient or audience',
    singleLine(draft.audience),
    '',
    '## Signal or hunch to investigate',
    paragraph(draft.observedSignal),
    '',
    '## Boundaries',
    paragraph(draft.boundaries) || 'Use the repository geography, evidence, safety, and editorial defaults. Discover occasion, budget, fit, rejection rules, and pair logic from qualifying public evidence.',
    '',
    '## Authority boundary',
    '- [x] This issue authorizes one bounded public opportunity-scout mission and at most one proposed strategy idea.',
    '- [x] The founder direction is a research hypothesis, not evidence. The scout must reject it when qualifying public evidence does not support it.',
    '- [x] This issue does not approve article research, affiliate activity, publishing, deployment, account changes, credentials, or spend.',
    '- [x] I included no credentials, tracking identifiers, private customer data, or private-group content.'
  ].join('\n') + '\n';
}

export function buildFounderScoutIssueUrl(draft: FounderScoutDirectionDraft) {
  if (!assessFounderScoutDirection(draft).ready) return null;
  const params = new URLSearchParams({
    title: `[Scout] ${singleLine(draft.direction).slice(0, 180)}`,
    body: buildFounderScoutDirectionMarkdown(draft),
    labels: 'opportunity-scout'
  });
  const url = `https://github.com/lucasdmoyer/tipsforyourgifts/issues/new?${params.toString()}`;
  return url.length <= 12_000 ? url : null;
}
