# Architecture

AGENTOWNERS separates pure policy decisions from environment-specific input and
effects. The core never calls GitHub, Git, a network, or a database.

## Flowchart

```mermaid
flowchart LR
  A[GitHub event or local Git range] --> B[Normalize context]
  B --> C[Detect agent signals]
  B --> D[Classify changed files]
  B --> E[Infer actions]
  C --> F[Evaluate policy]
  D --> F
  E --> F
  P[AGENTOWNERS.yml] --> F
  Z[Zod policy schema] --> P
  Z --> S[Generated JSON Schema]
  S --> P
  F --> G[Deterministic decision]
  G --> H[Markdown verdict]
  G --> I[Audit JSON]
  I --> K[Hash-chain verifier]
  G --> J[CI exit status]
```

## Component diagram

```mermaid
flowchart TB
  CLI["@agent-owners/cli<br/>Git adapter and terminal UX"]
  ACTION["@agent-owners/github-action<br/>GitHub API adapter"]
  CORE["@agent-owners/core<br/>Pure policy engine"]
  POLICY["AGENTOWNERS.yml"]
  SCHEMA["Generated JSON Schema<br/>Editor and agent authoring"]
  GIT["Local Git"]
  GH["GitHub API"]

  GIT --> CLI
  GH --> ACTION
  POLICY --> CLI
  POLICY --> ACTION
  SCHEMA -. validates authoring .-> POLICY
  CLI --> CORE
  ACTION --> CORE
  CORE -. no network, shell, or state .-> CORE
  CORE --> AUDIT[Capability audit and verifier]
  AUDIT --> ADAPTERS[Adapters and external log stores]
```

## Sequence diagram

```mermaid
sequenceDiagram
  participant Event as GitHub event
  participant Action as GitHub Action
  participant Core as Policy engine
  participant API as GitHub API

  Event->>Action: PR actor, metadata, changed files
  Action->>Core: normalized evaluation input
  Core->>Core: detect, classify, infer, evaluate, score
  Core-->>Action: Decision
  Action->>API: upsert verdict and labels
  Action-->>Event: outputs and optional failing status
```

Capability adapters may persist the pure audit result and call the verifier
before accepting it as evidence. Verification does not dispatch tools or
provide storage; it only proves the result's schema, chain, digest, and summary
are internally consistent.

## Trust boundaries

- Policy YAML, Git refs, event bodies, labels, and filenames are untrusted.
- The CLI passes Git refs as subprocess arguments without shell interpretation.
- The action requests only repository read plus PR and issue write permissions.
- The core returns data. Adapters own I/O and side effects.
- Conflicting rules resolve deterministically: `block > require_approval > allow`.
