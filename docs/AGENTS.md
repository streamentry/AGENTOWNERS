# Documentation

## Overview

Documentation states the product contract, trust boundaries, and verified
positioning. Time-sensitive ecosystem claims require dated official sources.

## Key Components

- `specs/`: canonical product and feature requirements
- `architecture.md`: component and trust-boundary design
- `ecosystem.md`: source-backed control-surface comparison
- `philosophy.md`: durable design principles
- `roadmap.md`: explicit future scope

## Diagrams

```mermaid
flowchart LR
  OfficialSources --> Ecosystem
  Specs --> Architecture
  Philosophy --> Specs
  Architecture --> README
  Ecosystem --> README
```

```mermaid
flowchart TB
  Contract[Canonical specs] --> ProductDocs
  Evidence[Official current evidence] --> Positioning
  ProductDocs --> Reader
  Positioning --> Reader
```

```mermaid
sequenceDiagram
  participant Contributor
  participant Source
  participant Docs
  Contributor->>Source: verify current claim
  Contributor->>Docs: state boundary and freshness
  Docs-->>Contributor: reviewable evidence trail
```

## Verification

Run `pnpm verify`, check every external link against its primary source, and
separate current product facts from roadmap claims.
