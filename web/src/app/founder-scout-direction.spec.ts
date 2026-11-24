import { assessFounderScoutDirection, buildFounderScoutDirectionMarkdown, buildFounderScoutIssueUrl, EMPTY_FOUNDER_SCOUT_DIRECTION, type FounderScoutDirectionDraft } from './founder-scout-direction';

function completeDirection(overrides: Partial<FounderScoutDirectionDraft> = {}): FounderScoutDirectionDraft {
  return {
    ...EMPTY_FOUNDER_SCOUT_DIRECTION,
    direction: 'Find thoughtful upgrades for a friend who is always golfing',
    audience: 'Recreational golfers who play most weekends',
    observedSignal: 'They keep improvising around small course-day annoyances instead of researching a better setup.',
    boundaries: 'Evergreen gifts under $100. Avoid personalized equipment and fit-sensitive clubs.',
    authorityConfirmed: true,
    noSensitiveDataConfirmed: true,
    ...overrides
  };
}

describe('founder scout direction contract', () => {
  it('keeps an incomplete direction out of the GitHub handoff', () => {
    const assessment = assessFounderScoutDirection({ ...EMPTY_FOUNDER_SCOUT_DIRECTION });
    expect(assessment.ready).toBe(false);
    expect(buildFounderScoutIssueUrl({ ...EMPTY_FOUNDER_SCOUT_DIRECTION })).toBeNull();
  });

  it('creates one bounded owner-authored scout issue', () => {
    const draft = completeDirection();
    expect(assessFounderScoutDirection(draft).ready).toBe(true);
    const issueUrl = buildFounderScoutIssueUrl(draft);
    expect(issueUrl).not.toBeNull();
    const parsed = new URL(issueUrl!);
    expect(parsed.pathname).toBe('/lucasdmoyer/tipsforyourgifts/issues/new');
    expect(parsed.searchParams.get('title')).toBe(`[Scout] ${draft.direction}`);
    expect(parsed.searchParams.get('labels')).toBe('opportunity-scout');
    expect(parsed.searchParams.get('body')).toContain('## Signal or hunch to investigate');
    expect(parsed.searchParams.get('body')).toContain('at most one proposed strategy idea');
    expect(parsed.searchParams.get('body')).not.toContain('approved_for_research');
  });

  it('makes founder direction a hypothesis rather than evidence', () => {
    const markdown = buildFounderScoutDirectionMarkdown(completeDirection());
    expect(markdown).toContain('research hypothesis, not evidence');
    expect(markdown).toContain('must reject it when qualifying public evidence does not support it');
    expect(markdown).toContain('does not approve article research');
  });

  it('fails closed on credential-like or oversized input', () => {
    expect(assessFounderScoutDirection(completeDirection({ boundaries: 'api_key=abcdefghijk123456789' })).ready).toBe(false);
    expect(buildFounderScoutIssueUrl(completeDirection({ boundaries: 'x'.repeat(3001) }))).toBeNull();
  });
});
