---
name: contribute-agentowners
description: Implement or review deterministic AI-agent governance changes in AGENTOWNERS
---

# Contribute to AGENTOWNERS

1. Read `AGENTS.md`, the nearest package `AGENTS.md`, and the relevant spec.
2. State the invariant and expected input-to-decision behavior.
3. Add the cheapest disconfirming test first.
4. Implement the smallest complete change.
5. Regenerate distributions with `pnpm build`; never hand-edit them.
6. If policy validation changed, run `pnpm generate:schema`.
7. Run `pnpm verify`.
8. For release-facing changes, run `pnpm verify:packages`.
9. In the pull request, disclose agent use, exact evidence, risks, and rollback.

Reject any change that weakens `block > require_approval > allow`, executes
policy data, leaks secret matches, introduces hidden state, or lets untrusted
input reach a shell.
