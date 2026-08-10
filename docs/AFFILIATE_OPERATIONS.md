# Affiliate operations

## Purpose

Affiliate revenue can fund the publication only if commission never changes which gift wins. `web/config/affiliate-programs.json` is the versioned decision registry, and the validator keeps research, founder interest, external enrollment, activation, and reporting as distinct states.

## Current decision queue

Two public candidates are recorded but disabled:

- [Bookshop.org US media affiliate](https://bookshop.org/affiliates/profile/introduction) is the narrower first candidate for book anchors and can align with the publication's interest in independent bookstores. It does not solve merchant coverage for every companion product; [the official program explanation](https://support.bookshop.org/en/support/solutions/articles/65000191390-can-you-explain-bookshop-org-s-affiliate-program-) remains the activation source.
- [Amazon Associates US](https://affiliate-program.amazon.com/) is the broader-catalog candidate. Its [operating agreement](https://affiliate-program.amazon.com/help/operating/agreement) requires program-provided link formats and current compliance review, and broad coverage raises a stronger editorial-bias risk.

The registry records no expected revenue, invented tracking identity, exact price, or account claim. Public terms change; the source-review expiry is a mandatory recheck point, not a guarantee.

## State and authority

```text
proposed -> founder_approved -> external enrollment -> audited activation PR -> enabled
     |              |                    |
  rejected        paused              terms or evidence fail -> disabled
```

- `proposed`: AI or editorial research may compare public fit and limitations. All activation fields stay empty.
- `founder_approved`: Lucas has approved spending attention on external onboarding. No account or link is implied.
- External enrollment: Lucas creates the account and accepts current terms outside Codex; this is never automated.
- `enabled`: allowed only after the contract records registered sites, allowed domains, program-provided tracking configuration, terms evidence, disclosure, and reporting posture.

The **Approve affiliate program for external onboarding** workflow is repository-owner-only and opens a pull request. Its message explicitly states that it does not enroll, accept terms, add tracking, enable links, or deploy.

After Lucas completes external onboarding personally, **Activate audited affiliate program** is the second protected workflow. It requires the exact founder-approved revision, action-time `ACTIVATE-<program-id>` confirmation, current terms-acceptance timestamp and evidence URL, registered production site, explicit merchant-domain allowlist, program-provided parameter names without values, and an aggregate-reporting decision. It records only non-secret configuration in a pull request. Activation creates zero paid links, authorizes no price feed, and cannot alter an editorial score or ranking.

## Activation proof

Before changing a candidate to `enabled`, attach a founder-controlled evidence reference and recheck:

1. current official terms and incorporated policies;
2. the production site registered with the program;
3. program-provided tracking identity and permitted link parameters;
4. allowed destination domains and redirect behavior;
5. exact site and article disclosure language;
6. price and availability display rules;
7. aggregate reporting export and privacy posture;
8. a Firebase preview proving destination, disclosure, and `rel="sponsored noopener"`.

An enabled program may monetize an existing editorial winner; it cannot increase the product's rank or rescue a weak recommendation.

After activation, exact destination-link candidates still require independent review, disclosure, `rel="sponsored noopener"`, a Firebase preview, and validation that removing tracking leaves the recommendation useful.

## Exact paid-link overlay

Program activation is not product-level approval. The paid-link lane keeps raw articles, research runs, article QA receipts, product order, scores, copy, and pairings unchanged:

```text
ordinary editorial winner
  -> founder-supplied program URL candidate
  -> isolated evidence-editor receipt
  -> founder exact-hash approval
  -> generated overlay
  -> Firebase preview
  -> separate exact-SHA production decision
```

1. **Record one affiliate link candidate** accepts one real program-issued public URL only after its program is enabled. It binds the URL to the exact source article, validated research run, independent article review, product editorial fingerprint, program revision, allowed final domain, approved tracking-key names, and credential-free product-identity evidence. Use candidate revision `1`; after a failed review, correct the problem and increment the immutable revision.
2. **Independently review one affiliate link** runs a separate evidence editor. It may create only one review receipt. A pass requires a live HTTPS response, allowlisted resolved domain, preserved tracking values, intended-product or edition match, no new price or availability claim, disclosure, sponsored relationship, unchanged editorial rank, and a recommendation that still works with the paid link removed. Uncertainty becomes a failed receipt.
3. **Approve one independently reviewed affiliate link** is repository-owner-only and requires the exact candidate SHA-256, clean review SHA-256, and action-time `APPROVE-<candidate-id>` confirmation. The receipt authorizes only a generated overlay and explicitly does not authorize production.

`web/scripts/lib/affiliate-link-contract.mjs` fails closed if an article, research run, article QA receipt, program revision, allowed domain, tracking key, candidate, review, or founder approval digest drifts. `generate-content.mjs` then replaces only the selected product URL in memory, marks that action as paid, adds the approved program ID, and turns on the article disclosure. Source Markdown and research evidence remain ordinary and commission-independent.

The public publication manifest records every active overlay's candidate, independent-review, and founder-approval paths and hashes. A candidate or passing review alone contributes zero rendered links. A program pause or source drift blocks the build until the state is safely resolved.

## Current link posture

The committed registry currently has no enabled program, no exact link candidates, no independent link receipts, no founder link approvals, and no active overlays. The workflows are dormant and create no account, credential, tracking identity, affiliate URL, external post, Firebase preview, or production deployment on their own.
