# Growth measurement and executive review

## Purpose

The growth loop decides what to improve only after the editorial system has produced useful, evidence-backed content. It separates four questions:

1. Did qualified people discover the article?
2. Did they engage with the decision framework?
3. Did they show merchant intent?
4. Did an approved affiliate program record a conversion or revenue?

Unknown values remain `null`. They are never converted to zero, estimated from another channel, or filled by an AI agent.

## Aggregate snapshot contract

`web/src/data/growth.json` is the versioned source of truth. A snapshot contains one complete reporting window of at least seven days, the exact active source connectors, credential-free evidence, a source-artifact SHA-256, and article-level aggregate metrics. Permitted sources are aggregate Search Console, consent-aware web analytics, approved affiliate-network, official social-platform, or a combined aggregate export.

The contract rejects inactive source connectors, metrics attributed to the wrong connector, personal identifiers, IP addresses, cookie or device identifiers, precise location, raw queries, signed evidence URLs, negative metrics, duplicate connector periods, unknown article slugs, and affiliate exports while no affiliate program is enabled. It contains credential *names* only, never values.

Prepare a JSON snapshot outside the repository, then import it locally:

```text
npm --prefix web run growth:import -- --input=/absolute/path/to/aggregate-snapshot.json
```

The importer validates the entire model before changing the versioned source.

## Search Console: founder setup, protected activation, then automation

The first measurement source is the exact URL-prefix property `https://tipsforyourgifts.web.app/`. Google documents that URL-prefix properties include only URLs under the specified protocol and prefix, and that ownership must be verified before private performance data is accessible: [property types](https://support.google.com/webmasters/answer/34592?hl=en) and [ownership verification](https://support.google.com/webmasters/answer/9008080?hl=en).

1. Lucas personally adds and verifies that property in Search Console. The workflow does not sign in, change DNS, upload a verification token, create a Google identity, or grant access.
2. Lucas establishes a least-privilege Google service account and GitHub workload-identity federation, grants that identity read access to the exact Search Console property, and stores only the provider and service-account references in the GitHub secrets `SEARCH_CONSOLE_WIF_PROVIDER` and `SEARCH_CONSOLE_SERVICE_ACCOUNT`. Google’s GitHub authentication action recommends workload identity over long-lived service-account keys: [authentication action](https://github.com/google-github-actions/auth).
3. Lucas records a credential-free issue or pull request covering ownership, exact property, identity, read-only scope, and reporting posture. **Configure aggregate Search Console measurement** binds that evidence and the exact current growth-registry digest in a pull request. It calls no Google API.
4. After reviewing and merging the configuration, Lucas runs **Activate aggregate Search Console collection** through the protected `growth-measurement` environment with the exact new digest and `ACTIVATE-search-console`. Activation also calls no Google API and imports no snapshot.
5. Only after that activation pull request merges may **Collect aggregate Search Console snapshot** authenticate. The Friday schedule queries finalized seven-day data using `webmasters.readonly`, never the read/write scope. The Search Analytics API supports page filtering and finalized data; the collector sends one exact page filter per publication-ready article and never requests or filters the `query` dimension: [Search Analytics query method](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) and [OAuth scopes](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing).

The collector keeps observed Search Console clicks and impressions, records an evidence URL and digest, and leaves every unsupported metric `null`. A page with no row in its exact filtered response receives an observed zero for those two Search Console metrics only. It writes no raw API response, access token, query, user identifier, or credential. A repeated identical reporting window no-ops. A new snapshot must pass the full repository validation, build, and smoke gates before its check-gated pull request can auto-merge.

Until Lucas completes these external account and credential steps and merges both founder-gated pull requests, the scheduled job exits before authentication and all traffic, conversion, and revenue results remain unknown.

## AI growth-team boundary

The weekly workflow runs on Monday and may also be started manually. The OpenAI credential is present only in a read-only job. The agent may use committed aggregate snapshots to create or revise proposed experiments in `growth.json`; it cannot approve or run an experiment, change a connector, rewrite a snapshot, alter strategy, publish social content, add affiliate tracking, spend money, or deploy.

A separate job without the AI credential verifies the patch boundary, reruns all deterministic gates, and opens a founder-review pull request. If no new complete snapshot supports a material decision, the correct output is no patch and no pull request.

## Experiment standard

Every experiment needs:

- a falsifiable hypothesis;
- publication-ready target articles;
- one primary aggregate metric;
- a comparable reporting window;
- exact source snapshot IDs;
- a decision rule written before results are read;
- at least two stop conditions;
- founder approval before `status` can become `approved` or `running`.

The first experiments test decision-first social concepts, observed-friction creative, and a restrained trust-to-guide internal path. They are proposals, not performance claims.
