# @agent-owners/cli

Local, deterministic governance checks for AI-agent contributions.

## Install

```bash
npm install --global @agent-owners/cli
```

## Use

```bash
# Create a conservative starter policy
agentowners init --profile strict-oss

# Reject malformed or misspelled policy fields
agentowners validate .github/AGENTOWNERS.yml

# Consume the deterministic validation contract in CI or another tool
agentowners validate .github/AGENTOWNERS.yml --output json

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

Git refs are passed directly to Git as arguments, never interpolated into a
shell command. Invalid refs fail closed instead of producing an empty,
potentially misleading decision.

`self-check` emits a versioned JSON contract and distinct exit codes for allow
(`0`), approval (`10`), block (`20`), invalid input (`64`), invalid policy
(`65`), invalid Git range (`66`), and internal failure (`70`). See the
[self-check specification](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/specs/f11-agent-self-check.md).

`validate --output json` emits a versioned result without policy contents or
absolute filesystem paths. Valid policies write a `status: "complete"` result
to stdout and exit `0`; invalid policies write a `status: "error"` result to
stderr and exit `1`. Unsupported output formats fail before loading policy and
exit `64`. The JSON contract is documented in the
[CLI specification](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/specs/f8-cli.md).

`test` exits `0` when every case passes, `1` for assertion failures, `64` for
invalid command input, `65` for invalid policy data, `66` for invalid fixture
data, and `70` for an unexpected internal failure. Use `--output json` for the
versioned machine result. See the
[fixture specification](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/specs/f13-policy-fixtures.md).

SARIF output is deterministic and contains only non-allow policy results.
Approval decisions are warnings and blocked decisions are errors.

See the [full documentation](https://github.com/streamentry/AGENTOWNERS#readme)
and [policy examples](https://github.com/streamentry/AGENTOWNERS/tree/main/examples).
