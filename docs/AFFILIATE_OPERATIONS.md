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
