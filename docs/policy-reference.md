# AGENTOWNERS policy reference

This is the concise reference for the `AGENTOWNERS.yml` contract. The runtime
validator and generated authoring schema are authoritative:

- [Zod policy schema](../packages/core/src/schema.ts)
- [generated JSON Schema](../packages/core/agentowners.schema.json)
- [copyable policy examples](../examples/README.md)

The policy is data. AGENTOWNERS parses it, classifies the event, infers the
requested actions, and returns a deterministic decision. It never executes
policy text as code.

## Minimal policy

```yaml
version: 1

defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block

rules:
  - name: Block workflow edits
    when:
      files:
        - '.github/workflows/**'
    effect: block
    reason: CI changes require direct maintainer review.
```

Save the file as `.github/AGENTOWNERS.yml`. Add the schema directive below to
enable editor completion and validation:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/streamentry/AGENTOWNERS/main/packages/core/agentowners.schema.json
```

Validate before enabling enforcement:

```bash
agentowners validate .github/AGENTOWNERS.yml
```

Unknown fields, an empty `match` object, an empty `when` object, invalid action
names, and conflicting action assignments are rejected.

## Root fields

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | `1` | Required schema version. It must be exactly `1`. |
| `agents` | map of agent policies | Optional agent-specific identity and action rules. |
| `defaults` | default policy | Optional fallback effects for identity and sensitive file classes. |
| `rules` | list of rules | Optional repository-wide conditions and effects. |
| `audit` | audit config | Optional deterministic audit-output configuration. |

All objects are strict. A typo is an error, not an ignored setting.

## Agent policies

An agent entry has a required non-empty `match` object and optional action
lists:

```yaml
agents:
  coding-agent:
    match:
      actors:
        - coding-agent[bot]
      prTitlePatterns:
        - '^\[agent\]'
      labels:
        - ai-generated
    allowed:
      - open_pr
      - update_pr
      - modify_docs
    requires_approval:
      - modify_dependencies
    blocked:
      - merge_pr
      - edit_workflows
```

### Match signals and trust

| Signal | Field | Trust boundary |
| --- | --- | --- |
| Authenticated GitHub actor | `actors` | `verified`; the only signal that can authenticate an agent by itself. |
| Commit author identity | `commitEmails`, `commitNames` | `unverified` metadata. Useful evidence, not authorization. |
| Pull-request title | `prTitlePatterns` | `unverified` and attacker-controlled. |
| Pull-request, issue, or comment body | `bodyPatterns` | `unverified` and attacker-controlled. |
| Labels | `labels` | `unverified` metadata unless an authenticated actor is also required. |

Detection confidence (`confirmed`, `likely`, `possible`, or `unknown`) is
separate from identity trust. A matching title, body, label, or commit author
must never turn an unknown actor into a privileged one. Sensitive `allow` rules
that use metadata must also name a trusted actor or a verified agent identity.

Each action may appear in only one of `allowed`, `requires_approval`, or
`blocked` for a given agent. The agent policy is evaluated against every
detected action. An allowlist does not authorize an unlisted action.

## Defaults

```yaml
defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block
```

The default order is:

1. Secret-file changes use `secrets`, otherwise `block`.
2. Workflow changes use `workflows`, otherwise `block`.
3. A documentation-only change uses `docs_only`, otherwise `allow`.
4. A verified known agent uses `known_agent`, otherwise `require_approval`.
5. An unknown or unverified agent uses `unknown_agent`, otherwise
   `require_approval`.

An explicit matching rule or agent action policy takes precedence over these
fallbacks.

## Repository rules

```yaml
rules:
  - name: Require approval for dependency changes
    when:
      changes_package_files: true
    effect: require_approval
    reviewers:
      - '@maintainers/core'
    labels:
      - dependency-review
    reason: Dependency changes affect the supply chain.
```

Each rule contains:

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Stable human-readable rule name. |
| `when` | yes | One or more conditions. Conditions in one rule are ANDed. |
| `effect` | yes | `allow`, `require_approval`, or `block`. |
| `reviewers` | no | Reviewer handles or teams returned in the decision. |
| `labels` | no | Labels returned for the matching decision. |
| `reason` | yes | Human-readable explanation for the decision. |

The effect priority is immutable:

```text
block > require_approval > allow
```

Multiple matching rules are all retained in the audit result. The highest
priority effect wins; rule order does not let an allow override a block.

### Conditions

| Condition | Type | Match behavior |
| --- | --- | --- |
| `agents` | `string[]` | Matches the detected agent name. An allow still requires verified identity. |
| `actors` | `string[]` | Exact authenticated actor match. |
| `actions` | `AgentAction[]` | Any listed action matches for block/approval; an allow must enumerate every detected action. |
| `files` | `string[]` | At least one changed path matches at least one picomatch glob. |
| `files_not` | `string[]` | No changed path may match any listed glob. |
| `labels` | `string[]` | At least one event label matches. |
| `pr_title`, `pr_body` | `string[]` | At least one case-insensitive substring or regular expression matches. |
| `issue_title`, `issue_body` | `string[]` | At least one case-insensitive substring or regular expression matches. |
| `diff_lines_over` | number | The supplied diff line count must be greater than the threshold. |
| `commits_over` | number | The supplied commit count must be greater than the threshold. |
| `changes_package_files` | boolean | Requires dependency-file classification. |
| `changes_workflows` | boolean | Requires workflow-file classification. |
| `changes_permissions` | boolean | Requires permission/auth-path classification. |
| `changes_auth` | boolean | Requires auth-path classification. |
| `changes_infra` | boolean | Requires infrastructure-path classification. |
| `docs_only` | boolean | Every changed path must be documentation. |
| `tests_only` | boolean | Every changed path must be a test. |

Arrays within one condition are ORed; different condition fields are ANDed.
For example, `files: ['src/**', 'lib/**']` matches either path family, while a
rule with both `files` and `changes_auth: true` requires both conditions.

## Actions

The policy action vocabulary is:

`open_pr`, `update_pr`, `comment`, `review_comment`, `approve_pr`,
`request_changes`, `label_issue`, `close_issue`, `reopen_issue`,
`assign_issue`, `edit_workflows`, `modify_tests`, `modify_docs`,
`modify_dependencies`, `modify_auth`, `modify_infra`, `touch_secrets`,
`change_permissions`, and `merge_pr`.

Pull-request events add `open_pr` or `update_pr` plus file-derived actions.
Issue comments add `comment`; submitted reviews add `review_comment` and,
when applicable, `approve_pr` or `request_changes`. `issues.labeled`,
`issues.closed`, and `issues.reopened` map to their corresponding issue action;
`issues.opened` currently contributes no inferred action. File classification
is conservative and includes dependency, workflow, auth, infrastructure, test,
documentation, and secret-path signals.

## Audit and outputs

```yaml
audit:
  enabled: true
  output: '.agentowners/audit/decision.json'
```

The decision contains the effect, matched rules, detected actions, risk score
and level, required reviewers, labels, and an explanation. Secret matches are
redacted; matched secret values are never emitted. CLI JSON and SARIF output
remain machine-readable and deterministic.

Use the portable fixture contract to lock down a policy’s intended behavior:

```bash
agentowners test \
  --policy .github/AGENTOWNERS.yml \
  --fixtures .agentowners/fixtures.yml
```

For a GitHub Action, begin with `mode: comment`, inspect verdicts, and only
then enable enforcement. Grant only `contents: read`, `pull-requests: write`,
and `issues: write` unless a separately reviewed integration requires less.

## Safer policy design

- Start with [`examples/minimal`](../examples/minimal/AGENTOWNERS.yml) or
  [`examples/strict-oss`](../examples/strict-oss/AGENTOWNERS.yml).
- Keep `unknown_agent` at `require_approval` or `block`.
- Block workflow, secret, permission, and high-impact authentication paths
  unless a human-owned process handles them.
- Treat titles, bodies, labels, and commit metadata as routing signals only.
- Add a portable fixture for every rule that matters to your merge boundary.
- Read the [threat model](threat-model.md) and [release runbook](releasing.md)
  before trusting an Action or package in a high-trust repository.
