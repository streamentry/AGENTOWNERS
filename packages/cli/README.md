# @agent-owners/cli

Local, deterministic governance checks for AI-agent contributions.

> **Pre-release:** this package is not published yet. The install command and
> CLI below describe the intended `0.1.0` contract. Evaluate the current source
> from the [AGENTOWNERS repository](https://github.com/streamentry/AGENTOWNERS);
> do not depend on an unpublished registry artifact.

Use the CLI for local Git ranges, policy validation, portable fixtures, SARIF,
and machine-readable agent preflight. Use `@agent-owners/core` when embedding
the engine, or the repository Action for GitHub event enforcement.

## Install

Available after the first public release:

```bash
npm install --global @agent-owners/cli
```

## Use

```bash
# Create a conservative starter policy
agentowners init --profile strict-oss

# Reject malformed or misspelled policy fields
agentowners validate .github/AGENTOWNERS.yml

# Evaluate a Git range
agentowners check --base main --head HEAD

# Run an explicit machine-readable pre-PR check
agentowners self-check \
  --policy .github/AGENTOWNERS.yml \
  --base origin/main \
  --head HEAD \
  --actor coding-agent[bot]

# Execute a portable policy contract
agentowners test \
  --policy .github/AGENTOWNERS.yml \
  --fixtures .agentowners/fixtures.yml

# Return nonzero when policy blocks the change
agentowners check --base main --head HEAD --mode enforcement

# Emit SARIF 2.1.0 for standard code-scanning tools
agentowners check --base main --head HEAD --output sarif > agentowners.sarif

# Inspect agent signals
agentowners fingerprint --commit HEAD
```

`fingerprint` reports detection confidence and identity trust separately. A
matching commit author or label is useful evidence, but it is not an
authenticated actor and cannot grant privileged policy actions.

Git refs are passed directly to Git as arguments, never interpolated into a
shell command. Invalid refs fail closed instead of producing an empty,
potentially misleading decision.

`self-check` emits a versioned JSON contract and distinct exit codes for allow
(`0`), approval (`10`), block (`20`), invalid input (`64`), invalid policy
(`65`), invalid Git range (`66`), and internal failure (`70`). See the
[self-check specification](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/specs/f11-agent-self-check.md).

`test` exits `0` when every case passes, `1` for assertion failures, `64` for
invalid command input, `65` for invalid policy data, `66` for invalid fixture
data, and `70` for an unexpected internal failure. Use `--output json` for the
versioned machine result. See the
[fixture specification](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/specs/f13-policy-fixtures.md).

SARIF output is deterministic and contains only non-allow policy results.
Approval decisions are warnings and blocked decisions are errors.

See the [full documentation](https://github.com/streamentry/AGENTOWNERS#readme)
and [policy examples](https://github.com/streamentry/AGENTOWNERS/tree/main/examples).
