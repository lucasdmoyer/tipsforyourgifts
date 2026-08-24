# Editorial policy

## Product score

Score editorial value out of 100 before considering commission:

| Dimension | Points |
|---|---:|
| Recipient and occasion fit | 20 |
| Practical usefulness | 15 |
| Quality and durability evidence | 15 |
| Value and ownership cost | 10 |
| Availability and delivery reliability | 10 |
| Meaningful differentiation | 10 |
| Warranty and return quality | 5 |
| Safety and accessibility | 5 |
| Cross-source sentiment consistency | 5 |
| Seller choice | 5 |

Require 75 or better. Commission never changes the rank.

## Thoughtfulness score

For schema 1.1, score each finalist out of 20: friction specificity 5, self-purchase logic 5, ownership ease 5, and recipient specificity 5. Require 15 or better with no component below 3. The scorecard must use an observation prompt, not assert private facts about a recipient.

"They would not buy it" is not sufficient. Distinguish replacement inertia, research burden, a deferred small luxury, or coordination burden from simply not wanting the product.

## Gift-pair coherence

Score pairs out of 100: shared curiosity 20, complementary roles 20, interaction loop 20, observable trigger 15, independent value 10, compatibility 10, and ownership ease 5. Require 80 or better. Both items must independently clear product gates. Reject pairs that merely match, add merchandise, duplicate the same job, leave compatibility unresolved, or need the weak item to be rescued by the strong one.

## Evidence confidence

Score confidence out of 100: primary coverage 40, independent corroboration 25, freshness 15, first-hand or original evidence 10, and conflict resolution 10. Require 70 or better. Use `desk_research` unless hands-on evidence is recorded.

## Affiliate gate

- Confirm the program is enabled in `web/config/affiliate-programs.json`.
- Confirm the final HTTPS domain is allowlisted and the destination is the intended product.
- Do not invent or append tracking parameters.
- Do not state exact price or availability without an authorized fresh feed.
- Add the article disclosure before recommendations and `rel="sponsored noopener"` to paid links.
- Keep the recommendation when its paid tracking is removed.

## Automatic stop conditions

Stop for founder review for a recall or unresolved safety issue, child or health claim, ingestible, financial claim, sponsored or free product, new affiliate program, unverified image right, hands-on claim, or high-risk legal conflict.
