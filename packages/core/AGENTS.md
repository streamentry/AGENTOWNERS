# Core policy engine

## Overview

Pure, deterministic policy evaluation. No filesystem writes, shell commands,
network calls, clocks, randomness, or persistent state.

## Key components

- `types.ts`: public contract
- `schema.ts`: untrusted YAML validation
- `json-schema.ts`: deterministic authoring schema derived from Zod
- `classifier.ts`: path and secret classification
- `detection.ts`: agent evidence
- `actions.ts`: event-to-action inference
- `evaluator.ts`: precedence and decision construction
- `scoring.ts`: deterministic risk score
- `renderer.ts`: Markdown and audit output

## Diagrams

```mermaid
flowchart LR
  Fixture --> Input
  Input --> Validate --> Detect
  Input --> Classify
  Input --> Infer
  Detect --> Evaluate
  Classify --> Evaluate
  Infer --> Evaluate
  Evaluate --> Decision
```

```mermaid
flowchart TB
  Types --> Zod
  Zod --> Loader
  Loader --> Detection
  Loader --> Classification
  Loader --> Inference
  Detection --> Evaluator
  Classification --> Evaluator
  Inference --> Evaluator
  Evaluator --> Scoring
  Evaluator --> Renderer
  Corpus[Adversarial corpus] -. probes .-> Zod
  Corpus -. probes .-> Detection
  Corpus -. probes .-> Classification
  Corpus -. probes .-> Evaluator
  Corpus -. probes .-> Scoring
```

```mermaid
sequenceDiagram
  participant Adapter
  participant Core
  Adapter->>Core: normalized input
  Core->>Core: pure evaluation
  Core-->>Adapter: immutable decision
```

## Verification

Run `pnpm --filter @agent-owners/core test` and `pnpm typecheck`.
After changing policy validation, run `pnpm generate:schema` and commit the
generated `agentowners.schema.json`.
For safety invariants, add a case to the adversarial corpus and prove it fails
under a temporary relevant mutation before restoring production code.
