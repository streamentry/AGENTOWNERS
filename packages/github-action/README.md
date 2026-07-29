# @agent-owners/github-action

The bundled JavaScript Action used by
[AGENTOWNERS](https://github.com/streamentry/AGENTOWNERS).

Most repositories should consume the GitHub Action directly, not install this
npm package:

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write

steps:
  - uses: actions/checkout@v7
  - uses: streamentry/AGENTOWNERS@v0
    with:
      policy-path: .github/AGENTOWNERS.yml
      mode: both
      fail-on-block: "true"
      # Optional: request only valid, missing reviewers named by policy rules.
      request-reviewers: "true"
```

For sensitive repositories, pin the full immutable commit SHA instead of a
moving major-version tag.

The Action uses Node 24, requests no administrative or secrets-reading
permission, and writes `agentowners-decision.json` for downstream audit
artifact upload. Reviewer requests are disabled by default; when enabled, the
Action requests only resolvable users and teams belonging to the repository's
organization, never the pull-request author. Re-runs are idempotent, and
stale `risk-*` labels are reconciled without removing user or policy labels.
