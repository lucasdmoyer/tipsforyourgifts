# Thoughtful gift framework

The editorial question is not "What products are popular?" It is "What have we noticed about this recipient that makes one gift unusually appropriate?"

## Recipient-friction thesis

A strong friction gift connects five facts:

1. **Observed workaround** — a recurring complaint, worn item, improvised tool, or awkward routine a giver could plausibly notice.
2. **Self-purchase gap** — the recipient welcomes the improvement but keeps deferring it because the workaround remains usable, research is annoying, coordination is hard, or the upgrade feels like a small luxury.
3. **Proof of fit** — a behavior, preference, routine, size, platform, or existing setup that can be checked before buying.
4. **Easy ownership** — low duplicate, clutter, storage, maintenance, account, and replacement burden.
5. **Honest rejection condition** — a clear reason this useful product belongs with a different recipient.

"They would never buy this" is not automatically a positive signal. If the real reason is that they do not want it, the candidate fails.

## Pairing thesis

Two items form a thoughtful pair only when one provides a lens and the other turns that lens into play, practice, observation, or debate.

Score pair coherence out of 100 before affiliate economics:

| Dimension | Points |
|---|---:|
| One shared curiosity or recipient identity | 20 |
| Different, complementary roles | 20 |
| A repeatable interaction loop | 20 |
| Triggered by something observable | 15 |
| Each item remains useful alone | 10 |
| Compatible time, equipment, skill, and player requirements | 10 |
| Low ownership burden | 5 |

Require 80 or better.

Reject the pair if it cannot answer all three questions:

- Can we explain the relationship without saying only that the items match?
- Does item B change how the recipient experiences item A?
- Is there a concrete "buy this only if" trigger?

Book plus mug, two beginner books, matching merchandise, and a technical hobby item chosen without compatibility evidence are bundles, not qualified pairs.

## Founder controls

`web/src/data/strategy.json` is the versioned executive decision ledger. Each idea records a revision, founder disposition, recipient insight, friction, self-purchase logic, fit signals, rejection conditions, success metric, and canonical research brief. Pairing ideas also record two distinct item roles, an interaction moment, compatibility checks, a coherence score, and clutter risk.

Only `approved_for_research` ideas can be resolved by `npm --prefix web run strategy:resolve -- <idea-id>`. The resolver emits the exact idea revision and SHA-256 digest before the research workflow receives an AI credential. New research runs must bind to that identity so later strategy drift cannot silently change the brief.

Pipeline stage is derived from research runs and article state. Strategy data never claims that an idea is previewed or live.

The autonomous opportunity scout applies the same framework before product research begins. It must compare multiple theses, cite independent public evidence for recipient language and behavior, and select only an idea that clears the evidence and thoughtfulness thresholds before affiliate economics. Its output remains `proposed`; only the founder-controlled exact-revision workflow can advance it to research.

## First proving cases

- **Golf friend:** start with small course-day frictions—dirty grooves, a worn towel, wet grip, weather exposure, or practice setup—and explicitly avoid clubs, balls, shoes, bags, and electronics without exact preference evidence.
- **Read it, then play it:** use *Sapiens* plus *Civilization VI* as the founder example. The book is a debatable macro-history lens; the game is an interactive systems counterpoint, not a validated history simulation. Confirm edition, ownership, platform, region, system requirements, reading appetite, and game taste.
