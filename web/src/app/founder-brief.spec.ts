import { assessFounderBrief, buildFounderBriefMarkdown, buildStrategyIssueUrl, EMPTY_FOUNDER_BRIEF, type FounderBriefDraft } from './founder-brief';

function completeDraft(overrides: Partial<FounderBriefDraft> = {}): FounderBriefDraft {
  return {
    ...EMPTY_FOUNDER_BRIEF,
    title: 'Small golf frustrations players tolerate instead of fixing',
    audience: 'Recreational golfers who play most weekends',
    occasion: 'Evergreen birthdays and Father’s Day',
    budget: '$25–$100',
    observedFriction: 'They wipe muddy grooves with a tee and keep reusing the same worn towel because the workaround still functions.',
    selfPurchaseGap: 'Small quality-of-life upgrades keep losing priority to green fees, balls, lessons, and major equipment research.',
    fitSignals: 'The giver has seen the workaround\nThe giver knows the recipient’s usual golf routine',
    rejectionConditions: 'They already own a good version\nThe item adds storage or maintenance burden',
    desiredOutcome: 'Five defensible finalists and three evidence-bound distribution angles.',
    authorityConfirmed: true,
    noSensitiveDataConfirmed: true,
    ...overrides
  };
}

describe('founder brief contract', () => {
  it('keeps an incomplete brief out of the GitHub handoff', () => {
    const assessment = assessFounderBrief({ ...EMPTY_FOUNDER_BRIEF });
    expect(assessment.ready).toBe(false);
    expect(assessment.missing).toContain('Observed workaround or recurring friction');
    expect(buildStrategyIssueUrl({ ...EMPTY_FOUNDER_BRIEF })).toBeNull();
  });

  it('creates one bounded owner-authored strategy issue URL', () => {
    const draft = completeDraft();
    const assessment = assessFounderBrief(draft);
    expect(assessment.ready).toBe(true);
    const issueUrl = buildStrategyIssueUrl(draft);
    expect(issueUrl).not.toBeNull();
    const parsed = new URL(issueUrl!);
    expect(parsed.origin).toBe('https://github.com');
    expect(parsed.pathname).toBe('/lucasdmoyer/tipsforyourgifts/issues/new');
    expect(parsed.searchParams.get('title')).toBe(`[Strategy] ${draft.title}`);
    expect(parsed.searchParams.get('labels')).toBe('strategy');
    expect(parsed.searchParams.get('body')).toContain('## What I noticed');
    expect(parsed.searchParams.get('body')).toContain('authorizes only one proposed strategy brief');
    expect(parsed.searchParams.get('body')).not.toContain('approved_for_research');
  });

  it('requires different pair roles, an interaction, and compatibility checks', () => {
    const incompletePair = completeDraft({ mode: 'coherent_pair' });
    const incomplete = assessFounderBrief(incompletePair);
    expect(incomplete.ready).toBe(false);
    expect(incomplete.missing).toEqual(expect.arrayContaining(['Two gifts with different roles', 'One concrete interaction moment', 'At least two compatibility checks']));

    const pair = completeDraft({
      mode: 'coherent_pair',
      title: 'History gifts that turn reading into an argument with a game',
      pairAnchor: 'A big-history book',
      pairCompanion: 'A strategy game about civilization systems',
      pairInteraction: 'Read one historical thesis, then test and debate its assumptions during the next game session.',
      compatibilityChecks: 'Confirm the recipient welcomes the book’s perspective\nConfirm their platform supports the intended game edition'
    });
    expect(assessFounderBrief(pair).ready).toBe(true);
    const markdown = buildFounderBriefMarkdown(pair);
    expect(markdown).toContain('## Proposed gift pair');
    expect(markdown).toContain('A big-history book');
    expect(markdown).toContain('### Compatibility, ownership, and clutter checks');
  });

  it('fails closed when credential-like text appears', () => {
    const unsafe = completeDraft({ exclusions: 'api_key=abcdefghijk123456789' });
    const assessment = assessFounderBrief(unsafe);
    expect(assessment.credentialLikeTextDetected).toBe(true);
    expect(assessment.ready).toBe(false);
    expect(buildStrategyIssueUrl(unsafe)).toBeNull();
  });

  it('rejects a brief that is too large for the bounded URL handoff', () => {
    const oversized = completeDraft({ exclusions: 'x'.repeat(5001) });
    const assessment = assessFounderBrief(oversized);
    expect(assessment.ready).toBe(false);
    expect(assessment.missing).toContain('Brief fits the bounded GitHub handoff');
    expect(buildStrategyIssueUrl(oversized)).toBeNull();
  });
});
