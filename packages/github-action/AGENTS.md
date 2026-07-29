# GitHub Action

## Overview

The Action adapts GitHub events and API data to the core engine, then applies
explicitly configured effects. The bundled `dist/index.js` is a release
artifact and must be regenerated, never hand-edited.

## Key components

- `src/index.ts`: orchestration and outputs
- `normalizeActionMode()`: fail-closed validation for the declared Action modes
- `src/github.ts`: event metadata adapter
- `src/policy.ts`: repository-relative policy validation and trusted-ref loading
- `src/comment.ts`: sticky verdict upsert
- `src/config.ts`: fail-closed runtime input validation
- `action.yml`: package-local metadata
- `dist/index.js`: committed Node 24 bundle

The Action is the runtime boundary for audit timestamps. It obtains the current
time and passes the value explicitly to the pure core renderer.

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
  Decision --> Audit[Audit JSON with adapter-supplied timestamp]
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
  Action->>Core: runtime timestamp for audit record
  Core-->>Action: decision
  Action->>GitHub: verdict and labels
  Action-->>Runner: outputs and status
```

## Verification

Run `pnpm --filter @agent-owners/github-action test`, `pnpm build`, and
`pnpm verify:release`.
