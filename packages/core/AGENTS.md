# Core policy engine

## Overview

Pure, deterministic policy evaluation. No filesystem writes, shell commands,
network calls, clocks, randomness, or persistent state.

## Key components

- `types.ts`: public contract
- `schema.ts`: untrusted YAML validation
- `json-schema.ts`: deterministic authoring schema derived from Zod
- `classifier.ts`: path and secret classification
- `detection.ts`: actor, commit, PR, issue, and comment evidence
- `actions.ts`: event-to-action inference
- `evaluator.ts`: event-specific rule matching, precedence, and decision construction
- `scoring.ts`: deterministic risk score
- `renderer.ts`: Markdown and audit output, including optional policy evidence
- `tests/custom-agents.test.ts`: repository custom-agent privilege contracts
- `fixtures.ts`: strict portable suites and assertion comparison
- `sarif.ts`: deterministic SARIF 2.1.0 output
- `capabilities.ts`: strict pre-dispatch capability validation, evaluation, and
  hash-chained audit output; no filesystem, network, or dispatch side effects
- `policy-diff.ts`: canonical policy fingerprints and value-free structural
  diffs; no filesystem, network, or policy-value output
- `tests/repository-policy.test.ts`: strict-schema regression coverage for the
  repository's checked-in policy and copyable policy template

Configured agent labels are candidate identity signals, not confirmed
identity. Keep `agents[name].match.labels` wired through `detectAgent()` while
preserving `possible` confidence so a mutable label cannot authorize an
otherwise unknown action. Blocking and approval rules may still fail closed.
The same conservative boundary applies to configured body/title patterns:
they are `likely`, while explicit actors and built-in verified bot actors are
the only confirmed identity paths. In `evaluateRule`, `when.agents` may route
`block` or `require_approval` for candidate identities, but an `allow` rule
requires `confirmed` confidence; use `when.actors` for explicit actor policy.

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

Run `pnpm --filter @agent-owners/core test` and `pnpm typecheck`.
Capability contract changes must keep `capabilities.test.ts` and the checked-in
identity-bound fixture behavior deterministic.
Custom-agent changes must keep `tests/custom-agents.test.ts` green.
Policy-diff changes must keep `tests/policy-diff.test.ts` deterministic and
must not add policy values to the diff contract. Structural changes must stay
aligned with the digest's canonicalization, including omitted undefined
optional fields.
Repository policy template changes must keep `tests/repository-policy.test.ts`
green so copyable configuration cannot drift from the strict schema.
After changing policy validation, run `pnpm generate:schema` and commit the
generated `agentowners.schema.json`.
For safety invariants, add a case to the adversarial corpus and prove it fails
under a temporary relevant mutation before restoring production code.
SARIF output must never contain timestamps, absolute paths, or unstable rule
identifiers.
