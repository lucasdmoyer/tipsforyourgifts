---
name: research-gift-opportunities
description: Research, score, draft, validate, and prepare evidence-backed gift guides and affiliate content for Tips for Your Gifts. Use when Lucas supplies a product, recipient, occasion, budget, social trend, content-cluster, or growth idea and wants the AI editorial team to turn it into a publication-ready research bundle and article.
---

# Research gift opportunities

Turn one founder direction into one defensible Git-versioned content bundle. Keep publication reversible and editorial ranking independent from commission.

## Inputs

Resolve or reasonably infer the audience, occasion, target publish window, budget bands, exclusions, geography, format, and success metric. Ask only when a missing choice materially changes risk or scope; otherwise record the assumption.

## Workflow

1. Read `AGENTS.md`, `web/config/affiliate-programs.json`, and [editorial policy](references/editorial-policy.md).
2. Resolve an approved strategy idea with `npm --prefix web run strategy:resolve -- <idea-id>` when an idea ID exists. Bind new schema 1.1 runs to its revision and SHA-256 digest.
3. Create one run ID: `YYYYMMDD-<slug>-<brief_hash_8>`.
4. Research in at least three passes. For roundups, collect at least 12 candidates and five qualified finalists across five source classes.
5. Treat social and forum content as demand and language evidence, not objective product truth. Never store private-group content or unnecessary personal identifiers.
6. Build a typed claim ledger. Connect every material product, friction, self-purchase, compatibility, clutter, and pair-coherence claim to source IDs; record conflicts and omit unsupported claims.
7. Score products before affiliate economics. Require editorial score `>= 75`, evidence confidence `>= 70`, one drawback, one primary source, and two independent sources for each roundup finalist.
8. Give every schema 1.1 finalist a thoughtfulness scorecard: observation prompt, friction evidence, welcomed physical-gift boundary, defensible self-purchase gap, duplicate and clutter risk, ownership burden, compatibility checks, and score `>= 15/20` with no component below 3.
9. For gift pairs, require two independently qualified items with different roles, one interaction loop, an observable recipient trigger, independent usefulness, resolved compatibility, and coherence `>= 80/100`. Name why the recipient may prefer only the anchor.
10. Use only founder-enabled affiliate programs. Never invent tracking parameters, exact prices, availability, ratings, quotes, reviews, or image rights. Omit paid tracking when validation is unavailable.
11. Draft `web/src/data/blog/<slug>.md`. Use `desk_research` unless hands-on evidence is documented. Never imply first-hand use without that evidence.
12. Have a separate independent-editor role challenge the bundle. The drafter cannot set its own QA pass.
13. Save `web/research/runs/<run_id>.json` using [the artifact contract](references/artifact-contract.md).
14. Run `npm run validate`, `npm run build`, and `npm run smoke` from the repository root. Fix only evidence, content, and build issues within the run.
15. Report the run ID, article path, scores, warnings, affiliate posture, and exact verification results. Prepare a branch or PR when requested; never deploy production from this skill.

## Research boundary

- Use authoritative product pages for specifications and current official policies.
- Use independent reviews, labs, public discussions, and safety authorities for corroboration and tradeoffs.
- Tier-D sources such as snippets, generic aggregators, affiliate listicles, and AI summaries may discover leads but cannot substantiate claims.
- Stop after minimum coverage and two consecutive passes each add less than 10 percent material novelty.
- Require founder review for sensitive categories, safety claims, children, ingestibles, health, electrical products, recalls, sponsored or free products, and changed affiliate terms.

## Completion contract

A model response is not completion. Completion requires a valid research artifact, matching article, independent QA, deterministic validation, successful static build and smoke result, and no production mutation. If a gate fails, leave the run in `qa_failed` or `drafted`, explain the smallest recovery action, and do not publish.
