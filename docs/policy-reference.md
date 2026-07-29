# AGENTOWNERS policy reference

This is the end-user guide to `.github/AGENTOWNERS.yml`. The runtime source of
truth is the strict Zod schema in `packages/core/src/schema.ts`; this page
explains the policy in terms maintainers can apply. If this page and the
validator disagree, the validator wins and the discrepancy should be fixed.

## Smallest useful policy

```yaml
version: 1

defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block

rules:
  - name: Block workflow changes
    when:
      files:
        - .github/workflows/**
    effect: block
    reason: Workflow changes require direct maintainer ownership.

  - name: Review dependency changes
    when:
      changes_package_files: true
    effect: require_approval
    reviewers:
      - '@maintainers/core'
    reason: Dependency changes affect the supply chain.
```

Create a profile instead of writing YAML by hand:

```bash
pnpm build
node packages/cli/dist/index.js init --profile strict-oss
node packages/cli/dist/index.js validate .github/AGENTOWNERS.yml
```

The built-in profiles are `minimal`, `strict-oss`, and `security-sensitive`.
The repository also includes a `monorepo` policy example for per-package
rules; it is not currently an `init --profile` option. Compare the built-in
trade-offs in the [profile chooser](../README.md#policy-profiles).

## File discovery

The CLI searches these paths in order:

1. `.github/AGENTOWNERS.yml`
2. `AGENTOWNERS.yml`
3. `.agentowners.yml`

If more than one exists, the first path wins and a warning lists the ignored
paths. The GitHub Action uses its explicit `policy-path` input and loads that
file from the trusted repository revision, not from the pull-request workspace.

## Top-level fields

| Field | Meaning |
| --- | --- |
| `version` | Required literal `1`. |
| `agents` | Optional named agent policies keyed by maintainer-chosen names. |
| `defaults` | Conservative fallback effects when no more-specific rule matches. |
| `rules` | Optional list of conditional effects and review metadata. |
| `audit` | Optional Action output path configuration for repository integrations. |

Unknown fields are rejected. Empty agent `match` objects and empty rule `when`
objects are rejected. A policy action cannot appear in more than one of an
agent's `allowed`, `requires_approval`, or `blocked` lists.

## Agent policies

An agent entry identifies evidence and assigns actions:

```yaml
agents:
  github-copilot:
    match:
      actors:
        - github-copilot[bot]
        - copilot-swe-agent[bot]
      prTitlePatterns:
        - '^\[Copilot\]'
    allowed:
      - open_pr
      - update_pr
      - modify_docs
    requires_approval:
      - modify_tests
      - modify_dependencies
    blocked:
      - edit_workflows
      - touch_secrets
      - change_permissions
      - merge_pr
```

Supported match signals are `actors`, `commitEmails`, `commitNames`,
`prTitlePatterns`, `bodyPatterns`, and `labels`. Explicit policy actor matches
are confirmed. Generic body markers and commit signatures are only likely
signals; they do not earn a known-agent default by themselves.

The v1 action vocabulary is:

```text
open_pr update_pr comment review_comment approve_pr request_changes
label_issue close_issue reopen_issue assign_issue edit_workflows modify_tests
modify_docs modify_dependencies modify_auth modify_infra touch_secrets
change_permissions merge_pr
```

An agent policy blocks if any detected action is blocked. Otherwise it requires
approval if any detected action requires approval. An `allowed` result applies
only when every detected action is explicitly allowed. Unlisted actions fall
through to repository rules and defaults.

## Rules and conditions

Each rule has a unique human-readable `name`, a non-empty `when` condition, an
`effect`, and a `reason`:

```yaml
rules:
  - name: Review authentication paths
    when:
      files:
        - '**/auth/**'
        - '**/permissions/**'
      agents:
        - github-copilot
    effect: require_approval
    reviewers:
      - '@maintainers/security'
    labels:
      - security-review
    reason: Authentication and permission changes require human review.
```

Available conditions are:

- identity and event context: `agents`, `actors`, `labels`, `pr_title`,
  `pr_body`, `issue_title`, `issue_body`;
- changed paths: `files`, `files_not`;
- size: `diff_lines_over`, `commits_over`;
- classification: `changes_package_files`, `changes_workflows`,
  `changes_permissions`, `changes_auth`, `changes_infra`, `docs_only`,
  `tests_only`;
- inferred actions: `actions`.

Conditions in one rule are conjunctive. Arrays inside one condition are
alternatives, so a `files` rule matches when any changed path matches any glob.
Text conditions use case-insensitive regular-expression matching; malformed
configured patterns fail closed for that signal.

## Effects, precedence, and defaults

Precedence is immutable:

```text
block > require_approval > allow
```

All matching rules are retained in the decision. The strongest effect wins;
reviewers and labels are collected from matching approval/block rules. A rule
that does not match contributes nothing. The engine does not use rule order as
a hidden “first match wins” override.

The conservative defaults are:

```yaml
defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block
```

Secret-file and workflow classifications are evaluated before ordinary agent
defaults. Unknown or spoofable identities never silently receive the
`known_agent` default.

## Validate and inspect a decision

```bash
agentowners validate .github/AGENTOWNERS.yml
agentowners check --base origin/main --head HEAD --output text
agentowners check --base origin/main --head HEAD --output json
agentowners check --base origin/main --head HEAD --output sarif > agentowners.sarif
agentowners self-check \
  --policy .github/AGENTOWNERS.yml \
  --base origin/main \
  --head HEAD \
  --actor your-agent-name
```

`self-check` returns exit `0` for allow, `10` for required approval, and `20`
for block. It emits a canonical `policyDigest` but never claims authorship or
approval. `policy-diff` compares two valid policies by digest and structural
JSON Pointer paths without printing policy values.

Run `pnpm verify` before changing a policy or opening a pull request. For a
portable, exact policy regression suite, see
[`f13-policy-fixtures.md`](specs/f13-policy-fixtures.md). For the full data
model and security rationale, see the [project specification](specs/readme.md)
and [threat model](threat-model.md).

## What this policy does not control

AGENTOWNERS governs repository-facing GitHub events. It is not an operating
system sandbox, network firewall, secret manager, cryptographic identity
system, model evaluator, or auto-merger. Pair it with least-privilege GitHub
permissions, runtime capability controls, secret scanning, branch protection,
and independent human review for high-impact changes.
