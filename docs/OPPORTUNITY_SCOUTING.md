# Autonomous opportunity scouting

The opportunity desk keeps the editorial roadmap moving without turning a model into an unchecked publisher. It may discover and propose one thoughtful-gift thesis. It cannot approve research, choose affiliate programs, publish an article, post on social media, spend money, create credentials, deploy Firebase, or change production.

## What counts as an opportunity

A qualifying thesis begins with something a giver could actually notice:

- a recurring irritation, workaround, worn object, incomplete routine, or repeated phrase
- a believable reason the recipient welcomes an improvement but postpones buying it
- at least two proof-of-fit signals and at least two reasons to reject the idea
- an editorial gap that is more useful than another generic product list
- when two gifts are paired, different roles in one shared story or ritual, an interaction moment, independent usefulness, and compatibility checks

The desk scores evidence confidence, thoughtfulness potential, differentiation, evergreen value, and production feasibility. Affiliate commission is excluded from selection.

## Evidence gate

`web/config/opportunity-scout-policy.json` is the versioned gate. A report requires:

- at least three research passes
- at least ten HTTPS public sources across five source classes
- at least two public social or community sources from distinct independence groups
- at least six opportunity signals, including recipient language, an observed workaround, a self-purchase gap, and an editorial gap
- three to seven scored candidates
- at least 70 evidence confidence and 80 thoughtfulness potential for the selected candidate
- two consecutive final passes below 10 percent material novelty
- no personal identifiers, private-group content, revenue claims, affiliate enrollment changes, or commission-led ranking

Social and community content may support language, demand, and observed behavior. It cannot substantiate product specifications, safety, effectiveness, popularity, or availability.

## Workflow and authority

The scheduled workflow runs weekly and can also be started manually.

1. A trusted step validates the repository and counts open founder proposals.
2. At five open proposals, the workflow exits before the model call with `founder_backlog_full`.
3. With capacity, a trusted mission binds the base commit, policy snapshot, next exact proposal ID, workflow run, and proposal-only authority.
4. The research role may create one drafted opportunity report and append one `proposed` strategy idea.
5. A different editor challenges the unchanged draft and may create only a hash-bound review receipt.
6. Trusted code verifies the mission, report, proposal, hashes, reviewer separation, and policy thresholds before promoting the report to `validated`.
7. Deterministic validation, Angular build, and smoke checks run without an AI credential before a founder-review pull request is opened.

Merging that pull request records only a proposal. A separate exact-revision approval pull request is required before the article-research workflow can start.

## Durable artifacts

- Policy: `web/config/opportunity-scout-policy.json`
- Trusted missions: `web/research/opportunity-missions/`
- Drafted or validated reports: `web/research/opportunities/`
- Independent receipts: `web/research/opportunity-reviews/`
- Deterministic validator: `npm --prefix web run validate:opportunities`
- Negative gate proof: `npm --prefix web run test:opportunity-gate`
- Command integration proof: `npm --prefix web run test:opportunity-commands`

These artifacts prove local and Git history. They do not prove a scheduled run occurred, a pull request merged, product research completed, a Firebase preview exists, or production changed.
