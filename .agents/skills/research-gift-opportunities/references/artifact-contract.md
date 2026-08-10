# Research artifact contract

Use the validated example in `web/research/runs/` as the structural starting point.

Required fields include schema version `1.0.0`, stable run and idea IDs, content type, status, topic, audience, occasion, budget bands, risk class, author, timestamps, research passes, sources, claims, candidates, finalists, affiliate links, article scores, evidence mode, and independent QA.

New recipient-friction or pairing runs use schema version `1.1.0`. They also require the exact `ideaRevision`, canonical `ideaSha256`, `decisionLens`, typed claim kinds, finalist thoughtfulness scorecards, and a `pairs` array when the approved strategy brief requires pairs.

For a roundup, include at least 12 candidates, five finalists, five source classes, and three independence groups. Give each finalist one drawback, one primary source, two independent sources, editorial score 75, and evidence confidence 70.

Schema 1.1 finalists additionally require an observation prompt, recipient-friction claim, physical-gift boundary, defensible self-purchase reason, duplicate and clutter controls, resolved compatibility, and thoughtfulness score of at least 15 out of 20. Qualified pairs require two distinct finalists, typed pair-coherence evidence, resolved compatibility, a reason to buy only the anchor, and coherence score of at least 80 out of 100. Article pair metadata and social claim, product, and pair references must exactly match the reviewed run.

For a validated run, include at least three passes. Make each of the final two `materialNoveltyRate` values less than `0.1`, support every claim, set a completion timestamp, and use an independent reviewer who is not the draft author.

Run `npm run validate` for the executable contract. Do not loosen the validator to make a weak bundle pass.
