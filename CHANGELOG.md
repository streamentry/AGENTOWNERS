# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and
semantic versioning.

## [Unreleased]

### Added

- A stable `audit-artifact` GitHub Action output and upload recipe so
  policy evidence survives blocked runs.
- A companion `audit-artifact-sha256` output for downstream verification of
  retained audit bytes.
- `agentowners explain --sha256` verification for Action audit artifacts before
  rendering their decisions.
- `agentowners explain` support for versioned Action audit artifacts, with
  provenance context and strict shape validation.
- Action audit artifacts now preserve decision labels for faithful downstream
  explanation and reconciliation; legacy v1 artifacts remain readable.
- A source-backed ecosystem boundary matrix and structured Ideas discussion
  form for falsifiable proposals.
- A manually invoked, read-only adversarial reviewer custom agent with a
  falsifiable finding contract.
- Release and isolated-consumer verification.
- Deterministic JSON Schema generation, editor integration, package export, and
  CI drift detection.
- Versioned `agentowners self-check` JSON and exit-code contract for agent
  preflight.
- Strict, portable policy fixture suites and the deterministic
  `agentowners test` runner.
- Deterministic SARIF 2.1.0 rendering and CLI output for code-scanning
  interoperability.
- Mutation-sensitive adversarial corpus covering precedence, conservative
  fallthrough, path boundaries, malformed patterns, schema conflicts, and risk
  caps.

### Changed

- Defined contribution lanes, overlap checks, attribution expectations, and
  evidence-based maintainer review outcomes.
- Replaced the vulnerable `minimatch` dependency chain with dependency-free
  `picomatch`.
- Updated the GitHub Actions toolkit dependencies.
- Updated the test and build dependency graph and pinned patched transitive
  versions so the npm advisory audit is clean.

### Fixed

- The Action audit artifact now uses a fixed workspace-relative filename so
  environment-controlled paths cannot reach the file-write sink.
- Malformed configured detection regex patterns no longer abort policy
  evaluation.
- Source-only changes no longer produce a false `modify_tests` action.
- Pull requests now use policy from the immutable base commit rather than the
  untrusted pull request workspace.
- Spoofable agent markers no longer receive known-agent defaults.
- CLI Git refs can no longer inject options into diff or log commands.
- Available pull request patch content now participates in secret detection.
- Git security fixtures no longer write identity into contributor Git
  configuration.
- `issue_title` and `issue_body` rule conditions now evaluate against issue
  metadata instead of being silently ignored.
- Issue comments now preserve whether their target is a pull request or issue,
  and their bodies participate in agent detection.

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
