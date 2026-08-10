# Tips for Your Gifts operating rules

## Mission

Build a trustworthy, profitable gift-recommendation publication. Optimize for reader value, evidence quality, reversibility, and sustainable growth before content volume.

## Required workflow

- Use the repo skill at `.agents/skills/research-gift-opportunities` for product research, gift guides, affiliate content, or editorial-strategy requests.
- Treat Git as the editorial source of truth. Research agents create versioned artifacts and article files; they never write directly to production databases.
- A research run is complete only after `npm run validate` and `npm run build` pass.
- Keep drafting and independent QA separate. The drafting agent cannot certify its own evidence.
- Never fabricate product experience, prices, availability, quotes, reviews, affiliate IDs, tracking parameters, source evidence, or image rights.
- If a product was not physically tested, call it a researched recommendation and do not imply first-hand use.
- Keep affiliate economics separate from editorial ranking. A recommendation must remain useful if its paid link is removed.
- Publish external social or email content only through official platform APIs and explicit founder-approved accounts, policies, cadence, and credentials.

## Production and security boundaries

- Do not deploy, change Firebase production state, create credentials, accept affiliate terms, publish social posts, or send email without Lucas's explicit action-time approval.
- Do not print, commit, or place secrets in prompts, content files, spreadsheets, logs, or screenshots.
- Use `tipsforyourgifts` as the explicit Firebase project target. Never rely on a globally selected Firebase project.
- Keep Firestore and Realtime Database closed unless a reviewed feature needs a narrower rule and emulator-backed tests.
- Preserve the legacy Angular source until Lucas approves its removal. Build and test the modern site in `web/`.

## Verification

Use Node 24.14 or newer.

```bash
npm run install:web
npm run validate
npm run build
```

Before proposing a production release, also run `npm run smoke` and verify a Firebase preview channel from the exact commit intended for release.

## Reporting

Report local, committed, pushed, previewed, and deployed status separately. A passing build or preview is not a production deployment.
