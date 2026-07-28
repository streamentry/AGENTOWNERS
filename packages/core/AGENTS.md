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
- `tests/custom-agents.test.ts`: repository custom-agent privilege contracts
- `fixtures.ts`: strict portable suites and assertion comparison

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
  Fixtures[Portable fixtures] --> Detection
  Fixtures --> Classification
  Fixtures --> Inference
  Fixtures --> Evaluator
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

```mermaid
sequenceDiagram
  participant Suite
  participant FixtureRunner
  participant Core
  Suite->>FixtureRunner: validated cases
  loop each case
    FixtureRunner->>Core: event, actor, files, signals
    Core-->>FixtureRunner: decision
    FixtureRunner->>FixtureRunner: compare requested assertions
  end
  FixtureRunner-->>Suite: stable case results
```

## Verification

Run `pnpm --filter @agent-owners/core test` and `pnpm typecheck`.
Custom-agent changes must keep `tests/custom-agents.test.ts` green.
After changing policy validation, run `pnpm generate:schema` and commit the
generated `agentowners.schema.json`.
For safety invariants, add a case to the adversarial corpus and prove it fails
under a temporary relevant mutation before restoring production code.
