# Core policy engine

## Overview

Pure, deterministic policy evaluation. No filesystem writes, shell commands,
network calls, clocks, randomness, or persistent state.

## Key components

- `types.ts`: public contract
- `schema.ts`: untrusted YAML validation
- `json-schema.ts`: deterministic authoring schema derived from Zod
- `classifier.ts`: path and secret classification
- `detection.ts`: actor, commit-author, label, PR, issue, and comment evidence
- `actions.ts`: event-to-action inference
- `evaluator.ts`: event-specific rule matching, precedence, and decision construction
- `scoring.ts`: deterministic risk score
- `renderer.ts`: Markdown and audit output
- `tests/custom-agents.test.ts`: repository custom-agent privilege contracts
- `fixtures.ts`: strict portable suites and assertion comparison
- `sarif.ts`: deterministic SARIF 2.1.0 output

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
  Evaluator --> SARIF
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
  Adapter->>Core: normalized PR, issue, or comment input
  Core->>Core: match event-specific metadata
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

Run `pnpm --filter @agent-owners/core test` and `pnpm typecheck`. Configured
actor, commit-author, and label matches must have focused detection or fixture
coverage; a schema field that the detector ignores is a policy safety defect.
Actor and known-bot matches are `identityTrust: verified`. Commit-author,
label, title, and body matches remain detection evidence but are
`identityTrust: unverified`; they must never grant an agent-specific allow
decision or the `known_agent` default. Unverified labels, titles, and bodies
also cannot satisfy an allow rule for sensitive actions unless the rule names
an explicit trusted actor or verified agent. Missing trust from a legacy
adapter is also treated as unverified at the evaluator boundary.
Custom-agent changes must keep `tests/custom-agents.test.ts` green.
After changing policy validation, run `pnpm generate:schema` and commit the
generated `agentowners.schema.json`.
For safety invariants, add a case to the adversarial corpus and prove it fails
under a temporary relevant mutation before restoring production code.
SARIF output must never contain timestamps, absolute paths, or unstable rule
identifiers.
