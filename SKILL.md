---
name: contribute-agentowners
description: Implement or review deterministic AI-agent governance changes in AGENTOWNERS
---

# Contribute to AGENTOWNERS

1. Read `AGENTS.md`, the nearest package `AGENTS.md`, and the relevant spec.
2. State the invariant and expected input-to-decision behavior.
3. Add the cheapest disconfirming test first.
4. Implement the smallest complete change.
5. For a safety invariant, prove the new test fails under a temporary relevant
   mutation, then restore production code exactly.
6. Regenerate distributions with `pnpm build`; never hand-edit them.
7. If policy validation changed, run `pnpm generate:schema`.
8. Run `pnpm verify`.
9. Run the explicit `agentowners self-check` contract before opening a pull
   request.
10. For Action governance changes, test notification idempotency and preserve
    user-owned labels before regenerating the bundle.
11. For release-facing changes, run `pnpm verify:packages`.
12. In the pull request, disclose agent use, exact evidence, risks, and rollback.

Reject any change that weakens `block > require_approval > allow`, executes
policy data, leaks secret matches, introduces hidden state, or lets untrusted
input reach a shell.
