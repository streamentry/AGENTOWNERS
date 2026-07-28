# @agent-owners/github-action

The bundled JavaScript Action used by
[AGENTOWNERS](https://github.com/streamentry/AGENTOWNERS).

> **Pre-release:** this npm package and the stable `v0` Action tag are not
> published yet. The workflow below documents the intended release contract.
> Evaluate from the
> [AGENTOWNERS repository](https://github.com/streamentry/AGENTOWNERS) and do
> not pin a production workflow to `main`.

Most repositories should consume the GitHub Action directly, not install this
npm package. After the first public release:

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
      # Change this only when github-token writes as another account.
      comment-author: github-actions[bot]
```

For sensitive repositories, pin the full immutable commit SHA instead of a
moving major-version tag.

The Action uses Node 24, requests no administrative or secrets-reading
permission, and writes `agentowners-decision.json` for downstream audit
artifact upload. The audit record includes identity trust so reviewers can
distinguish authenticated actors from spoofable commit, label, title, and body
evidence. Re-running the Action replaces stale AGENTOWNERS `risk-*` labels
without removing unrelated maintainer labels. Sticky verdict updates require a
complete marker authored by `comment-author`; a contributor cannot forge a
marker and have their comment overwritten. The default is
`github-actions[bot]`. Set it when a custom token writes as another account.
