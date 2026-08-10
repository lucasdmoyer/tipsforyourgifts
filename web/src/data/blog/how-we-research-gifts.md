---
title: "How we research gifts without pretending we tested them"
description: "The evidence, scoring, affiliate, and independent-review system behind every recommendation published by Tips for Your Gifts."
publishDate: 2026-08-02
updatedDate: 2026-08-02
status: publication_ready
audience: "Thoughtful gift buyers"
occasion: "Every occasion"
priceBand: "All budgets"
tags:
  - research
  - transparency
  - editorial standards
researchRun: "20260802-editorial-standard-6a5ce1b9"
evidenceScore: 92
evidenceMode: editorial_standard
featured: true
affiliateDisclosure: false
products: []
---

Gift advice has an uncomfortable shortcut: it is easy to rewrite a merchant page, add a cheerful adjective, and call the result a recommendation. We are building a different system.

Our goal is not to publish the most gift lists. It is to make each decision easier to defend. That means separating discovery from proof, editorial value from commission, and a finished draft from a publishable article.

## Research starts broad

A product roundup begins with at least 12 candidates. The research team looks across five source classes: the manufacturer, merchant policies, independent reviews, public consumer discussions, and relevant safety or recall authorities. Search snippets and other affiliate lists can surface leads, but they do not prove a claim.

We run at least three passes. Research stops only after two consecutive passes add little material information. This is a practical saturation rule: one search query is never treated as a complete market view.

## Every finalist has to earn its place

Finalists need an editorial score of at least 75 out of 100 and evidence confidence of at least 70. The editorial score covers recipient fit, practical usefulness, durability evidence, value, availability, differentiation, returns, safety, cross-source consistency, and seller choice.

The commission rate is not part of that score. A product has to remain useful if every paid tracking parameter disappears.

Each recommendation also names a drawback. “Best” without a tradeoff is usually marketing, not decision support. Google’s own guidance for product reviews emphasizes original research, quantitative comparisons where useful, benefits and drawbacks, and evidence that helps readers choose among sellers ([Google Search Central](https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews)).

## Desk research is not hands-on testing

Unless we bought, handled, and documented a product, our evidence mode is `desk_research`. We do not say “we tested,” “we used,” or invent a personal story to make the copy sound warmer.

This matters beyond tone. The FTC’s consumer-review rule covers fake or false reviews and testimonials, including AI-generated ones ([Federal Trade Commission](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers)). An honest researched recommendation can help. A fabricated experience cannot.

## Paid relationships stay visible

If a link may earn a commission, the article discloses that relationship before the first recommendation, and the link receives a nearby paid-link label when necessary. The FTC says disclosures should be clear, conspicuous, and close to the endorsement ([FTC endorsement guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)). Search engines also ask publishers to qualify paid links with `rel="sponsored"` ([Google outbound-link guidance](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links)).

We do not append an affiliate ID simply because an agent guesses the format. A program must be enabled in the repo registry with approved domains, disclosure language, and a founder-supplied tracking identity. Until that happens, the link stays non-affiliate.

## The writer does not approve the writer

After drafting, an independent editorial role challenges the evidence ledger, unsupported superlatives, copied language, outdated links, disclosure placement, image rights, and the difference between product fact and inference.

Then deterministic checks validate the research artifact, content schema, stable slug, metadata, affiliate allowlist, static build, and required publication files. Google explicitly warns that producing many low-value AI pages can violate its scaled-content abuse policy ([Google’s generative-AI guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)). The right response is not to hide AI use. It is to demand original value and a reviewable process.

## Publication is a release, not a keystroke

A finished research agent creates a versioned bundle and a reviewable Git change. Passing checks can create a Firebase preview. Production remains a separate decision until the exact preview, project target, rollback path, and first releases are proven.

That is the standard we want readers to feel on every page: useful ideas, honest limits, and enough evidence to make the final choice your own.
