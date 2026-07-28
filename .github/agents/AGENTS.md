# Repository Custom Agents

## Overview

Custom agents encode narrow contributor workflows. Tool access must be no
broader than the task, and agent output never replaces required human review.

## Key Components

- `policy-engineer.agent.md`: tests-first implementation and policy review
- `adversarial-reviewer.agent.md`: manually invoked, read-only falsification

## Diagrams

```mermaid
flowchart LR
  Change --> Reviewer
  Specs --> Reviewer
  Invariants --> Reviewer
  Reviewer --> Findings
  Reviewer --> ResidualRisk
```

```mermaid
flowchart TB
  Profile --> ToolBoundary[read and search only]
  ToolBoundary --> Evidence
  Evidence --> HumanReview
  HumanReview --> Decision
```

```mermaid
sequenceDiagram
  participant Contributor
  participant ReviewerAgent
  participant Human
  Contributor->>ReviewerAgent: request adversarial review
  ReviewerAgent->>ReviewerAgent: falsify claims read-only
  ReviewerAgent-->>Human: findings and residual risks
  Human->>Human: independently review and decide
```

## Verification

Validate frontmatter against GitHub's current custom-agent contract. Reviewer
profiles must remain non-editing and must state that their output is not
independent approval.
