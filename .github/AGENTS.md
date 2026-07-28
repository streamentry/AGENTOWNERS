# GitHub Community and Automation

## Overview

Repository-native GitHub configuration defines contribution intake, review
ownership, policy enforcement, and CI. Workflow edits remain hard-blocked for
agents under the repository policy.

## Key Components

- `AGENTOWNERS.yml`: policy applied to this repository
- `CODEOWNERS`: human ownership routing
- `ISSUE_TEMPLATE/`: structured defect and feature intake
- `DISCUSSION_TEMPLATE/`: structured community proposals
- `PULL_REQUEST_TEMPLATE.md`: contribution evidence contract
- `workflows/`: protected CI and release automation

## Diagrams

```mermaid
flowchart LR
  Contributor --> IssueForm
  Contributor --> DiscussionForm
  IssueForm --> Work
  DiscussionForm --> Work
  Work --> PullRequest
  PullRequest --> Policy
  PullRequest --> CI
```

```mermaid
flowchart TB
  CODEOWNERS --> Review
  AGENTOWNERS --> Decision
  Workflows --> Checks
  Decision --> MergeGate
  Review --> MergeGate
  Checks --> MergeGate
```

```mermaid
sequenceDiagram
  participant Contributor
  participant GitHub
  participant Maintainer
  Contributor->>GitHub: structured evidence
  GitHub->>Maintainer: route proposal or change
  Maintainer->>GitHub: evidence-based disposition
  GitHub-->>Contributor: auditable outcome
```

## Verification

Discussion form filenames must match category slugs. The feature form must
capture acceptance criteria and a cheapest disconfirming test. The pull-request
template must route each change to the narrowest review lane and record the
self-check result before human review. Validate YAML structure, run `pnpm
verify`, and never modify workflows when policy self-check blocks it.
