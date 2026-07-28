# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and
semantic versioning.

## [Unreleased]

### Added

- Release and isolated-consumer verification.
- Deterministic JSON Schema generation, editor integration, package export, and
  CI drift detection.
- Versioned `agentowners self-check` JSON and exit-code contract for agent
  preflight.
- Mutation-sensitive adversarial corpus covering precedence, conservative
  fallthrough, path boundaries, malformed patterns, schema conflicts, and risk
  caps.
- Policy-configured, idempotent reviewer requests and reserved risk-label lifecycle
  reconciliation in the GitHub Action.

### Changed

- Replaced the vulnerable `minimatch` dependency chain with dependency-free
  `picomatch`.
- Updated the GitHub Actions toolkit dependencies.

### Fixed

- Malformed configured detection regex patterns no longer abort policy
  evaluation.
- Source-only changes no longer produce a false `modify_tests` action.

## [0.1.0] - 2026-07-28

### Added

- Deterministic core policy engine with strict Zod validation.
- Agent detection, action inference, file classification, risk scoring, and
  Markdown and JSON rendering.
- CLI commands for initialization, validation, local checks, explanation, and
  fingerprinting.
- Node 24 GitHub Action with sticky verdicts, labels, outputs, and audit JSON.
- Minimal, strict open-source, security-sensitive, and monorepo policy profiles.
- Repository-native contributor instructions, issue forms, diagrams, and
  security reporting.

### Security

- Agent-specific action lists are enforced with
  `block > require_approval > allow`.
- Unknown policy fields and empty rule conditions fail validation.
- CLI Git refs bypass shell interpretation.
- Missing GitHub credentials fail closed.
- Risk scores are capped at 100.

[Unreleased]: https://github.com/streamentry/AGENTOWNERS/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/streamentry/AGENTOWNERS/releases/tag/v0.1.0
