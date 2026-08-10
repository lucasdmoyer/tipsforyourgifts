# Research mission operating model

## Founder command surface

Lucas chooses and approves the thesis. The system resolves the exact approved idea revision and digest before an AI credential is available. The durable receipt calls this an `approved_strategy_dispatch`: the approval merge is the authority, while the recorded actor may be the automation that performs the dispatch or Lucas during manual recovery.

Run the exact **Approve strategy idea for research** command shown in Studio and merge its review pull request. The `strategy-approved-launch` workflow classifies the exact before/after strategy change, rejects any thesis rewrite or multi-idea approval, reruns the gates, and dispatches the research mission automatically.

For recovery after a failed dispatch, start the research workflow manually:

```bash
gh workflow run research-agent.yml -f idea_id=founder-idea-005
```

In Codex or ChatGPT, the equivalent executive instruction is: “Approve the proposed Tips for Your Gifts thesis `founder-idea-005` for research.” The approval pull-request merge is the founder action; the research dispatch, drafting, independent QA, deterministic verification, branch, and pull request then run as the team workflow.

## Mission receipt

Before Codex receives a key, the trusted workflow writes `web/research/missions/research-mission-<workflow-run>-<attempt>.json`. The record binds:

- the approved idea ID, revision, canonical SHA-256, and base Git commit;
- the research, independent-review, release, and growth roles with narrow authority;
- exactly one research run, article, social launch pack, and independent QA receipt;
- the source, scoring, thoughtfulness, pairing, and affiliate gates;
- the publication policy snapshot in effect when the mission started.

The drafting agent cannot edit that envelope. A separate editor can create only the hash-bound QA receipt. Trusted scripts promote the reviewed bundle and complete the mission receipt with the exact SHA-256 digest of every output.

## Team handoffs

1. **Research editorial team — draft only.** Deep public research, typed claim ledger, qualified finalists, thoughtful-fit analysis, article, and draft social pack.
2. **Independent evidence editor — receipt only.** Challenges sources, conflicts, safety, drawbacks, compatibility, self-purchase logic, clutter, pair coherence, merchant links, and affiliate posture.
3. **Release operator — preview and pull request only.** Re-runs deterministic gates, creates the isolated branch, and opens the pull request. The PR preview is review evidence; after merge, the protected production workflow creates the final exact-`master`-SHA candidate and carries that same static artifact across the founder approval boundary.
4. **Growth analyst — aggregate measurement only.** After release, imports approved complete reporting windows and evaluates traffic, engagement, outbound clicks, conversions, and revenue without personal data.

## Completion is a handoff, not a deployment

A completed mission proves that one versioned research bundle passed independent QA and deterministic validation. It does not prove that its pull request merged or that Firebase production changed.

The current publication policy is `founder_reviewed`. After ten verified founder-reviewed releases and a separate founder approval, the repository can switch to `automatic_after_proven`; at that point, a completed mission becomes eligible for check-gated automatic merge. The generated publication manifest binds the mission's exact content and QA artifacts into the release-candidate set, but remains preparation evidence only. Production deployment still requires the exact commit, an exact-SHA Firebase candidate, a cloned rollback channel, live smoke, and a validated release receipt that binds the deployed manifest bytes.

## Failure and retry behavior

- Concurrency is keyed by idea ID so two missions cannot research the same approved thesis simultaneously.
- The initial mission envelope is uploaded before the model runs, preserving the intended scope when research fails or returns no patch.
- A retry receives a new mission ID because the workflow attempt is part of the identity.
- The quality job rejects a changed envelope, multiple run artifacts, forbidden paths, self-review, changed evidence after review, or a failed deterministic gate.
- A completed receipt never authorizes affiliate enrollment, credential creation, account configuration, social posting, or production mutation.
