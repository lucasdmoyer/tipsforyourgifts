# Social operations

## Purpose

The research pipeline already produces channel-native drafts that point to owned articles. `web/social/candidates/`, `web/config/social-channels.json`, and the approval-receipt directories turn those drafts into a reviewable queue without granting browser-posting authority or storing credentials.

## Channel gate

Every channel begins `not_connected`, with zero cadence and publishing disabled. Before a content approval can be recorded, Lucas must approve:

1. the official owned account;
2. the platform's official API and secret name, with the secret value kept outside Git;
3. original or licensed asset production and evidence;
4. allowed formats, disclosure, cadence, moderation, and rollback posture;
5. aggregate reporting access and privacy behavior.

Configured and active channels require founder approval. Only `active` may set `publishingEnabled: true`, and browser posting remains prohibited.

The channel boundary now has two executable, hash-bound founder handoffs:

1. **Configure official social channel** consumes the exact registry SHA-256 and records a non-secret account reference, publication-target ID, official API adapter, secret-name reference, evidence URL, and maximum cadence. It leaves publishing disabled and makes no platform call.
2. **Activate official social publishing boundary** rechecks the exact configured registry digest in the protected `social-production` environment and records `active`. It publishes and schedules zero posts; every post still needs media approval, content approval, action-time confirmation, the official API, a durable pre-call lock, and an external-ID receipt.

Configuration evidence belongs in a credential-free HTTPS issue or pull request. Token values, signed URLs, cookies, API responses, and account recovery data never belong in the workflow inputs or Git.

## Original creative candidate

AI may generate an original visual candidate only when it is bound to the exact post, source pack and post hashes, local Firebase path, future stable owned URL, byte digest, dimensions, alt text, generator, and automated visual checks. Candidate records live under `web/social/candidates/`; the image bytes live under `web/public/social-media/`.

The first candidate, `golf-friend-friction-decoder-v1`, is a 1024×1536 checklist that visualizes four witnessed golfer frictions without product photography, merchant imagery, logos, prices, ratings, or performance claims. Its candidate status means generated and locally verified—not founder rights-approved, released, content-approved, or published.

## Media approval

The **Approve one social media asset** workflow consumes the exact candidate ID and candidate-record SHA-256, then downloads its stable owned HTTPS URL, rejects redirects or private hosts, limits size and content type, verifies the candidate byte digest, and records current founder rights evidence. The publisher repeats the download and byte check immediately before posting, so a changed URL cannot silently swap the approved creative.

Media approval does not approve the copy and does not publish.

## Content approval

The **Approve one social draft** workflow is repository-owner-only. It requires the exact post ID, exact source-pack SHA-256, exact approved-media record SHA-256, and matching HTTPS rights-evidence reference. The resulting receipt binds:

- the source pack and post hashes;
- one platform and destination;
- copy, disclosure, and asset-rights approval;
- the founder identity and approval time.

Changing the draft, pack, destination, or evidence invalidates the receipt. The workflow opens a pull request and performs no external write.

## Official Pinterest publication

The first implemented publisher is Pinterest image Pins through `POST https://api.pinterest.com/v5/pins`. It is intentionally unusable until the registry contains a founder-approved active account, board ID, `pinterest-api-v5`, a nonzero cadence, and the secret-name reference `PINTEREST_ACCESS_TOKEN`.

The **Publish one approved Pinterest Pin** workflow adds four independent protections:

1. repository-owner dispatch with exact master SHA, approval digest, media-record digest, and `PUBLISH-<post-id>` confirmation;
2. the protected `social-production` GitHub environment, which should require Lucas as reviewer and hold the token as an environment secret;
3. a durable `social-publish-lock/<post-id>` tag created before the API call, preventing blind retries if a later Git step fails;
4. an uploaded receipt artifact plus a pull request containing the external Pin ID, request/response digests, source hashes, and official endpoint.

The job never logs the token or the API response body. It refuses to treat a 201 response as success unless Pinterest returns a valid Pin ID. The public media bytes are fetched and rehashed immediately before the official API call.

Current Pinterest prerequisites must be completed by Lucas in the platform UI: create or use a business account, accept current developer terms, register an app, obtain appropriate API access and scopes, choose the owned board, and store the access token only in the protected GitHub environment. Trial-created Pins are visible only to their creator; public production publishing requires an approved Standard-access posture. See [Pinterest Connect app](https://developers.pinterest.com/docs/getting-started/connect-app/), [authentication and scopes](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/), [Create Pin](https://developers.pinterest.com/docs/api/v5/pins-create/), and [access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/).

## Publication truth

```text
draft -> original creative candidate -> stable Firebase URL -> approved media bytes -> hash-bound content approval -> active channel -> protected official API -> external post ID receipt -> aggregate snapshot
```

An approval receipt is not a post. Only an official API response with an external post ID plus the immutable publication receipt counts as published. If a publication lock exists without a merged receipt, recover the uploaded artifact and reconcile the external Pin before considering any retry. Removing a lock, deleting a Pin, or rolling back externally always requires a separate founder decision. Missing impressions, clicks, or revenue remain unknown rather than zero.
