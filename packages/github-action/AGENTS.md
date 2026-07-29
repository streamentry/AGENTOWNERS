# GitHub Action

## Overview

The Action adapts GitHub events and API data to the core engine, then applies
explicitly configured effects. The bundled `dist/index.js` is a release
artifact and must be regenerated, never hand-edited.

## Key components

- `src/index.ts`: orchestration and outputs
- `src/github.ts`: event metadata adapter
- `src/policy.ts`: repository-relative policy validation and trusted-ref loading
- `src/comment.ts`: sticky verdict upsert
- `src/config.ts`: fail-closed runtime input validation
- `src/audit.ts`: symlink-safe audit artifact writing
- `action.yml`: package-local metadata
- `dist/index.js`: committed Node 24 bundle

## Diagrams

```mermaid
flowchart LR
  Event --> Adapter
  PR[PR metadata] --> Adapter
  Issue[Issue metadata] --> Adapter
  BaseCommit --> TrustedPolicy
  Adapter --> Core
  TrustedPolicy --> Core
  PatchContent --> SecretDetection --> Core
  Core --> Decision
  Decision --> Comment
  Decision --> Labels
  Decision --> Outputs
  Decision --> Audit[Audit JSON with safe workspace path]
  Decision --> Status
```

```mermaid
sequenceDiagram
  participant Runner
  participant Action
  participant Core
  participant GitHub
  Runner->>Action: event and token
  Action->>GitHub: read distinct PR or issue metadata
  Action->>GitHub: fetch policy at base SHA
  Action->>GitHub: read available file patches
  Action->>Core: distinct PR and issue fields
  Action->>Core: comment body as detection evidence
  Core-->>Action: decision
  Action->>GitHub: verdict and labels
  Action-->>Runner: outputs and status
```

Audit output is opened with a no-follow file flag; runners without that
primitive fail closed. This rejects checkout-provided symlinks at the fixed
output path. New artifacts use owner-only permissions (`0600`).

## Verification

Run `pnpm --filter @agent-owners/github-action test`, `pnpm build`, and
`pnpm verify:release`.
