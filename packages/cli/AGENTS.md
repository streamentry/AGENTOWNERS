# CLI

## Overview

The CLI adapts local Git state to the pure core engine. Git refs are untrusted
input and must be passed as argv through `execFileSync`, never through a shell.
Place refs after `--end-of-options`; argv separation alone does not stop Git
from interpreting a ref that begins with `-` as an option.

## Key components

- `src/git.ts`: bounded Git subprocess adapter
- `src/commands/init.ts`: profile installation
- `src/commands/validate.ts`: schema diagnostics
- `src/commands/check.ts`: local policy evaluation
- `src/commands/explain.ts`: Decision and Action audit explanation with strict
  parsing and optional SHA-256 verification
- `src/commands/fingerprint.ts`: agent-signal inspection
- `src/commands/self-check.ts`: versioned machine-readable pre-PR contract
- `src/commands/test.ts`: portable policy fixture execution

## Diagrams

```mermaid
flowchart LR
  Args --> Command --> Git
  TestFixture --> PerProcessIdentity
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
  CLI->>Git: argv with option boundary
  Git-->>CLI: files and commits
  CLI->>Core: evaluation input
  Core-->>CLI: decision
  CLI-->>User: Markdown, JSON, or SARIF and exit code
```

`test` reads explicit policy and fixture paths. It does not inspect Git state
or infer missing inputs.

```mermaid
stateDiagram-v2
  [*] --> ValidateFixtureArgs
  ValidateFixtureArgs --> InputError: missing path or output format
  ValidateFixtureArgs --> LoadPolicy: valid
  LoadPolicy --> PolicyError: invalid
  LoadPolicy --> LoadFixtures: valid
  LoadFixtures --> FixtureError: invalid
  LoadFixtures --> ExecuteCases: valid
  ExecuteCases --> Pass: all assertions match
  ExecuteCases --> Fail: assertion mismatch
  ExecuteCases --> InternalError: unexpected failure
  Pass --> [*]: exit 0
  Fail --> [*]: exit 1
  InputError --> [*]: exit 64
  PolicyError --> [*]: exit 65
  FixtureError --> [*]: exit 66
  InternalError --> [*]: exit 70
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
Temporary Git fixtures must pass author and committer identity through the
single commit subprocess environment. Never use `git config` in tests.
Unknown output formats must fail before reading Git.
