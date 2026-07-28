# CLI

## Overview

The CLI adapts local Git state to the pure core engine. Git refs are untrusted
input and must be passed as argv through `execFileSync`, never through a shell.

## Key components

- `src/git.ts`: bounded Git subprocess adapter
- `src/commands/init.ts`: profile installation
- `src/commands/validate.ts`: schema diagnostics
- `src/commands/check.ts`: local policy evaluation
- `src/commands/explain.ts`: decision explanation
- `src/commands/fingerprint.ts`: agent-signal inspection
- `src/commands/self-check.ts`: versioned machine-readable pre-PR contract

## Diagrams

```mermaid
flowchart LR
  Args --> Command --> Git
  Git --> Core
  Policy --> Core
  Core --> Output
  Core --> ExitCode
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Git
  participant Core
  User->>CLI: check --base --head
  CLI->>Git: argv without shell
  Git-->>CLI: files and commits
  CLI->>Core: evaluation input
  Core-->>CLI: decision
  CLI-->>User: verdict and exit code
```

`self-check` follows the same sequence but requires explicit policy, base,
head, and actor inputs. It returns JSON only and never infers identity.

```mermaid
stateDiagram-v2
  [*] --> ValidateInputs
  ValidateInputs --> InputError: missing input or unknown version
  ValidateInputs --> LoadPolicy: valid
  LoadPolicy --> PolicyError: read or validation failure
  LoadPolicy --> ReadGit: valid
  ReadGit --> GitError: unresolved ref
  ReadGit --> Evaluate: valid range
  Evaluate --> Allow
  Evaluate --> Approval
  Evaluate --> Block
  Evaluate --> InternalError: unexpected failure
  Allow --> [*]: exit 0
  Approval --> [*]: exit 10
  Block --> [*]: exit 20
  InputError --> [*]: exit 64
  PolicyError --> [*]: exit 65
  GitError --> [*]: exit 66
  InternalError --> [*]: exit 70
```

## Verification

Run `pnpm --filter @agent-owners/cli test`, `pnpm build`, and
`pnpm verify:release`.
