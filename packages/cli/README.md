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

# Return nonzero when policy blocks the change
agentowners check --base main --head HEAD --mode enforcement

# Inspect agent signals
agentowners fingerprint --commit HEAD
```

Git refs are passed directly to Git as arguments, never interpolated into a
shell command. Invalid refs fail closed instead of producing an empty,
potentially misleading decision.

See the [full documentation](https://github.com/streamentry/AGENTOWNERS#readme)
and [policy examples](https://github.com/streamentry/AGENTOWNERS/tree/main/examples).
