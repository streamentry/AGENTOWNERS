# AGENTOWNERS in five minutes

AGENTOWNERS is a repository policy boundary for AI-agent contributions. It
does not inspect model quality or replace branch protection. It answers one
narrow question from checked-in policy and event data: should this action be
allowed, require human approval, or be blocked?

This guide uses the source tree because the first `0.1.0` package release is
not public yet. Once the release gates are complete, the same policy contract
is available through the npm CLI and the stable GitHub Action tag.

## 1. Install and prove the checkout

Requirements: Node.js 22 or newer and pnpm 9 or newer.

```bash
git clone https://github.com/streamentry/AGENTOWNERS.git
cd AGENTOWNERS
corepack enable
pnpm install --frozen-lockfile
pnpm demo
```

`pnpm demo` builds the production CLI and runs three real policy cases:

| Case | Decision | Boundary demonstrated |
| --- | --- | --- |
| Documentation change | `require_approval` | Conservative review routing |
| Workflow change | `block` | Sensitive automation protection |
| Dependency change | `require_approval` | Supply-chain review routing |

For the complete repository gate, run `pnpm verify`. For the isolated packed
consumer and production dependency audit, run `pnpm verify:packages`.

## 2. Create a policy in another repository

Copy the least restrictive example that matches the repository’s risk. The
examples are complete YAML contracts, not templates with hidden defaults:

```bash
mkdir -p .github
cp /path/to/AGENTOWNERS/examples/strict-oss/AGENTOWNERS.yml \
  .github/AGENTOWNERS.yml
```

If the source checkout is not available, copy the profile from the [policy
examples](../examples/README.md) or generate one after the first CLI release:

```bash
agentowners init --profile strict-oss
```

Add editor validation to the policy’s first line:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/streamentry/AGENTOWNERS/main/packages/core/agentowners.schema.json
```

Then validate the exact file:

```bash
agentowners validate .github/AGENTOWNERS.yml
```

Read the [policy reference](policy-reference.md) before changing defaults or
using metadata-based matches. Titles, bodies, labels, and commit authors are
useful routing evidence but are not authenticated identity.

## 3. Run the first local decision

Build the CLI from source when packages are unavailable:

```bash
pnpm --filter @agent-owners/cli build
node packages/cli/dist/index.js check \
  --policy .github/AGENTOWNERS.yml \
  --base main \
  --head HEAD \
  --mode advisory
```

Use `--output json` for automation or `--output sarif` for code-scanning
upload. Use `--mode enforcement` only when a blocked decision should return a
nonzero status. Advisory mode is the safer first deployment because it exposes
the verdict before it changes merge behavior.

The local check reads a zero-context Git patch with external diff drivers and
text conversion disabled. It scans that patch for secret patterns using the
same redacted boundary as the GitHub Action; matched values never appear in
the verdict.

For an agent’s pre-PR contract, use explicit inputs and preserve the exit
boundary:

```bash
node packages/cli/dist/index.js self-check \
  --policy .github/AGENTOWNERS.yml \
  --base origin/main \
  --head HEAD \
  --actor coding-agent[bot]
```

The machine-readable result uses stable exit codes:

| Exit | Meaning | Next action |
| ---: | --- | --- |
| `0` | Allow | Proceed |
| `10` | Approval required | Request human approval |
| `20` | Block | Revise the change |
| `64`–`70` | Invalid input, policy, Git range, or internal failure | Fix the reported boundary |

An approval result is not a test failure. It is an explicit governance result.

## 4. Lock the contract with fixtures

When a policy matters to a merge boundary, add a portable fixture suite beside
it. The fixture runner exercises the same detection, classification, action
inference, and evaluation path used in production:

```bash
agentowners test \
  --policy .github/AGENTOWNERS.yml \
  --fixtures .agentowners/fixtures.yml
```

Assert exact decisions for workflow, secret, dependency, unknown-agent, and
docs-only cases. Keep the smallest counterexample that would disprove the
policy. A green broad suite does not prove that a particular rule reaches the
intended branch.

## 5. Enable the Action cautiously

After local verdicts are understandable, add the Action in comment mode:

```yaml
name: AGENTOWNERS

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
  issues:
    types: [opened, labeled, closed, reopened]
  issue_comment:
    types: [created, edited]
  pull_request_review:
    types: [submitted]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  agentowners:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: streamentry/AGENTOWNERS@v0
        with:
          policy-path: .github/AGENTOWNERS.yml
          mode: comment
          fail-on-block: 'true'
```

The `v0` reference is intentionally unavailable until the stable release is
published. For a high-trust repository, pin the immutable release commit SHA
instead of a moving major tag. Do not grant administrative or secrets-reading
permissions.

## What to check before enforcement

- Unknown agents still resolve to `require_approval` or `block`.
- Workflow, secret, permission, and sensitive authentication paths are not
  silently allowed.
- A sensitive `allow` rule names a trusted actor or verified agent identity.
- Action-scoped `allow` rules enumerate every detected action.
- The Action loads policy from the immutable pull-request base revision.
- Verdict comments, labels, JSON, SARIF, and audit files contain no secret
  values or terminal control sequences.
- `pnpm verify` and `pnpm verify:packages` pass from a clean worktree.

The [threat model](threat-model.md), [policy reference](policy-reference.md),
and [release runbook](releasing.md) define the boundaries behind these checks.
