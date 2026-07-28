# Roadmap

The roadmap is ordered by user risk removed, not feature count.

## Now: trustworthy v0

- Reproducible npm packages with provenance
- Bundled, directly consumable Node 24 GitHub Action
- Release smoke tests for ESM, CommonJS, CLI, and Action entry points
- Dogfooded policy, contribution templates, and private vulnerability reporting
- Stable policy examples and migration notes

## Next: explainability and interoperability

- `agentowners self-check` for agents before they open a pull request
- SARIF output for code-scanning integration
- Explicit reviewer requests and label lifecycle controls
- Policy fixtures that can be shared across repositories
- Machine-readable JSON Schema for editor completion

## Later: governed expansion

- Signed agent manifests and verifiable provenance
- Organization-level policy inheritance
- GitLab adapter
- Webhook mode for installations that need centralized enforcement

## Deliberate non-goals

AGENTOWNERS will not become a model host, code reviewer, autonomous merger,
database-backed dashboard, or agent framework. Its advantage is a small,
deterministic repository boundary that composes with all of them.
