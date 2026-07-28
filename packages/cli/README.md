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

# Evaluate a Git range
agentowners check --base main --head HEAD

# Run an explicit machine-readable pre-PR check
agentowners self-check \
  --policy .github/AGENTOWNERS.yml \
  --base origin/main \
  --head HEAD \
  --actor coding-agent[bot]

# Return nonzero when policy blocks the change
agentowners check --base main --head HEAD --mode enforcement

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

See the [full documentation](https://github.com/streamentry/AGENTOWNERS#readme)
and [policy examples](https://github.com/streamentry/AGENTOWNERS/tree/main/examples).
