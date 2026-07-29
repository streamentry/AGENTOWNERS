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
  - id: agentowners
    uses: streamentry/AGENTOWNERS@v0
    with:
      policy-path: .github/AGENTOWNERS.yml
      mode: both
      fail-on-block: "true"
  - if: ${{ always() }}
    uses: actions/upload-artifact@v4
    with:
      name: agentowners-decision
      path: ${{ steps.agentowners.outputs.audit-artifact }}
      if-no-files-found: error
```

For sensitive repositories, pin the full immutable commit SHA instead of a
moving major-version tag.

The Action uses Node 24, requests no administrative or secrets-reading
permission, and writes a versioned `agentowners-decision.json` audit artifact.
The `audit-artifact` output exposes its exact path so a workflow can upload the
record even when policy enforcement fails the step.
