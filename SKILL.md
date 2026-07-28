---
name: contribute-agentowners
description: Implement or review deterministic AI-agent governance changes in AGENTOWNERS
---

# Contribute to AGENTOWNERS

1. Read `AGENTS.md`, the nearest package `AGENTS.md`, and the relevant spec.
2. Refresh `origin/main`; inspect open and recently merged work for overlap.
3. State the invariant, expected behavior, and any distinct value retained from
   related contributions.
4. Use the contribution evidence matrix in `CONTRIBUTING.md` to select the
   focused proof required for every touched surface.
5. For ecosystem or positioning claims, use dated official sources and state
   what AGENTOWNERS does not control.
6. Keep pull request and issue metadata in distinct evaluator fields so
   event-specific conditions cannot match the wrong event type.
7. Add the cheapest disconfirming test first.
8. Implement the smallest complete change.
9. For a safety invariant, prove the new test fails under a temporary relevant
   mutation, then restore production code exactly.
10. Regenerate distributions with `pnpm build`; never hand-edit them.
11. If policy validation changed, run `pnpm generate:schema`.
12. If decision behavior changed, update a portable fixture that proves the
   repository-facing contract.
13. If capability-boundary behavior changed, run `pnpm test:capabilities` and
   `node scripts/capability-demo.mjs`; verify the demo remains simulation-only
   and does not print secret values.
14. If SARIF changed, prove stable IDs, ordering, and repository-relative paths.
15. Run `pnpm verify`.
16. Run the explicit `agentowners self-check` contract before opening a pull
   request.
17. For release-facing changes, run `pnpm verify:packages`.
18. For Marketplace changes, prove root and packaged Action metadata remain in
   parity outside explicit distribution identity and bundle paths, then
   disclose every owner-only publication gate that remains.
19. In the pull request, disclose agent use, overlap, exact evidence, risks,
    attribution, and rollback.

Reject any change that weakens `block > require_approval > allow`, executes
policy data, leaks secret matches, introduces hidden state, or lets untrusted
input reach a shell. For GitHub pull requests, load policy from the immutable
base commit. For CLI Git operations, treat refs as hostile options and use
`--end-of-options`.
Tests must not mutate contributor Git configuration; scope fixture identity to
the exact subprocess that needs it.

During review, report only findings that identify the violated invariant, exact
mechanism, and cheapest disconfirming test. AI-assisted review prepares evidence
for a human; it never satisfies independent approval.
