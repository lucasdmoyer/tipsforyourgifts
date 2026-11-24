# Research artifact contract

Use the validated example in `web/research/runs/` as the structural starting point.

Required fields include schema version `1.0.0`, stable run and idea IDs, content type, status, topic, audience, occasion, budget bands, risk class, author, timestamps, research passes, sources, claims, candidates, finalists, affiliate links, article scores, evidence mode, and independent QA.

New recipient-friction or pairing runs use schema version `1.2.0`. They also require the exact `ideaRevision`, canonical `ideaSha256`, `decisionLens`, typed claim kinds, finalist thoughtfulness scorecards, source qualifications, and a `pairs` array when the approved strategy brief requires pairs. Schema 1.0 and 1.1 artifacts remain readable as historical formats.

For a roundup, include at least 12 candidates, five finalists, five source classes, and three independence groups. Give each finalist one drawback, one primary source, two independent sources, editorial score 75, and evidence confidence 70.

Schema 1.2 finalists additionally require an observation prompt, recipient-friction claim, physical-gift boundary, defensible self-purchase reason, duplicate and clutter controls, resolved compatibility, and thoughtfulness score of at least 15 out of 20. Qualified pairs require two distinct finalists, typed pair-coherence evidence, resolved compatibility, a reason to buy only the anchor, and coherence score of at least 80 out of 100. Article pair metadata and social claim, product, and pair references must exactly match the reviewed run.

For every schema 1.2 finalist, `sourceQualifications` must exactly cover every `primarySourceId` and `independentSourceId`. Each entry records the source role, exact-product match, content format, commercial relationship, qualification decision, rationale, and any conflict-ledger IDs. A qualifying source must match the exact product. Primary evidence must be a first-party manufacturer page. Independent evidence cannot be Tier D, a category-only or product-line substitute, an affiliate listicle, a supplied product, sponsored content, first-party material, or a source with an unknown commercial relationship. Disclosed affiliate-supported first-person or comparative reviews may qualify only at Tier C and must bind to the conflict ledger. Merchant-hosted reviews may qualify only as exact-product owner-review corpora with the hosting relationship disclosed in the conflict ledger.

```json
{
  "sourceQualifications": [
    {
      "sourceId": "src-product-official",
      "role": "primary",
      "productMatch": "exact_product",
      "contentFormat": "manufacturer_page",
      "commercialRelationship": "first_party",
      "qualification": "qualifies",
      "rationale": "The manufacturer page names the exact finalist and documents its official specification boundary.",
      "conflictIds": []
    },
    {
      "sourceId": "src-product-owner-corpus",
      "role": "independent",
      "productMatch": "exact_product",
      "contentFormat": "owner_review_corpus",
      "commercialRelationship": "merchant_hosted_reviews",
      "qualification": "qualifies",
      "rationale": "Verified owners discuss the exact product; subjective handling evidence is kept separate from official specifications.",
      "conflictIds": ["merchant-hosting-disclosed"]
    }
  ]
}
```

Every recommendation article must also satisfy the executable `recipient-specialty-v1` reader contract. Its frontmatter includes `readerIntro` and `specialtyLens`; its six required reader sections explain the product, real-life fit, existing general-purpose setup, specialty addition, thoughtful reason, and pre-purchase checks. This presentation layer does not replace or weaken the run's evidence, claim, compatibility, drawback, or review requirements.

For a validated run, include at least three passes. Make each of the final two `materialNoveltyRate` values less than `0.1`, support every claim, set a completion timestamp, and use an independent reviewer who is not the draft author.

Run `npm run validate` for the executable contract. Do not loosen the validator to make a weak bundle pass.
