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
```

For sensitive repositories, pin the full immutable commit SHA instead of a
moving major-version tag.

The Action uses Node 24, requests no administrative or secrets-reading
permission, and writes `agentowners-decision.json` for downstream audit
artifact upload. It rejects checkout-provided symlinks at that fixed output
path and forces audit files to owner-only permissions (`0600`).
