# Roadmap

The roadmap is ordered by user risk removed, not feature count.

## Now: trustworthy v0

- Reproducible npm packages with provenance
- Bundled, directly consumable Node 24 GitHub Action
- Release smoke tests for ESM, CommonJS, CLI, and Action entry points
- Machine-readable JSON Schema with editor completion and CI drift detection
- Versioned agent self-check contract for pre-PR policy decisions
 - Policy-configured reviewer requests and reserved risk-label lifecycle controls
 - Portable executable policy fixtures for repository-owned regression tests
 - Deterministic SARIF 2.1.0 output for code-scanning interoperability
- Dogfooded policy, contribution templates, and private vulnerability reporting
- Stable policy examples and migration notes

## Next: explainability and interoperability

 - Explicit reviewer requests and label lifecycle controls
 - SARIF output for code-scanning integration
 - Policy fixtures that can be shared across repositories

## Later: governed expansion

- Signed agent manifests and verifiable provenance
- Organization-level policy inheritance
- GitLab adapter
- Webhook mode for installations that need centralized enforcement

## Deliberate non-goals

AGENTOWNERS will not become a model host, code reviewer, autonomous merger,
database-backed dashboard, or agent framework. Its advantage is a small,
deterministic repository boundary that composes with all of them.
