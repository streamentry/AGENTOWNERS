# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and
semantic versioning.

## [Unreleased]

### Added

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
- Experimental `AGENT_CAPABILITIES.md` specification with a deterministic,
  fail-closed capability and hash-chained audit demonstration.
- A tested Marketplace metadata gate covering YAML validity, listing identity,
  bundle paths, and root/package metadata parity.
- Idempotent release helper primitives with exact-version registry preflight,
  isolated npm cache verification, and stable-tag safety tests.
- A network-free `pnpm demo` that exercises the production CLI fixture pipeline
  and capability-boundary proof in one first-run command.
- Capability requests now present and verify the manifest-bound identity hash,
  with an adversarial mismatch test.
- Reusable capability validation/evaluation is now exported from `@agent-owners/core`
  and exposed through `agentowners capabilities` with stable output and
  `--fail-on-deny`.
- Deterministic `diffPolicies()` / `hashPolicy()` evidence and the
  `agentowners policy-diff` CLI command report policy fingerprints and changed
  paths without printing policy values.
- `agentowners self-check` now includes the canonical policy digest in success
  output so pre-PR evidence can be bound to the policy it evaluated.
- GitHub Action audit records now include the canonical policy digest and
  trusted policy ref, with matching `policy-digest` and `policy-ref` outputs.
- A canonical policy authoring reference and AGENTOWNERS-specific evidence-first
  agent-team workflow replace broken and unrelated contributor guidance.
- Strict-schema regression coverage for the repository policy and copyable
  `.github/AGENTOWNERS.yml.example` template.
- Reconciled the Claude contributor guide with the current dependency, spec
  layout, verification gates, and policy-template review contract.
- Clarified in the primary README that `monorepo` is a copyable example, not a
  currently exposed `agentowners init --profile` option.
- Kept policy-diff structural changes consistent with canonical digests when
  public callers provide explicitly undefined optional fields.

### Changed

- Defined contribution lanes, overlap checks, attribution expectations, and
  evidence-based maintainer review outcomes.
- Replaced the vulnerable `minimatch` dependency chain with dependency-free
  `picomatch`.
- Updated the GitHub Actions toolkit dependencies.
- Updated the test and build dependency graph and pinned patched transitive
  versions so the npm advisory audit is clean.

### Fixed

- GitHub Action mode inputs now fail closed before token or API access when the
  value is not one of `comment`, `check`, `both`, or `dry-run`.
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
- The copyable repository policy template no longer uses removed legacy fields
  or claims that rule order overrides immutable effect precedence.

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
