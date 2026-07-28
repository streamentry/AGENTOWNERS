---
name: contribute-agentowners
description: Implement or review deterministic AI-agent governance changes in AGENTOWNERS
---

# Contribute to AGENTOWNERS

1. Read `AGENTS.md`, the nearest package `AGENTS.md`, and the relevant spec.
2. Refresh `origin/main`; inspect open and recently merged work for overlap.
3. State the invariant, expected behavior, and any distinct value retained from
   related contributions.
4. For ecosystem or positioning claims, use dated official sources and state
   what AGENTOWNERS does not control.
5. Keep pull request and issue metadata in distinct evaluator fields so
   event-specific conditions cannot match the wrong event type.
6. Add the cheapest disconfirming test first.
7. Implement the smallest complete change.
8. For a safety invariant, prove the new test fails under a temporary relevant
   mutation, then restore production code exactly.
9. Regenerate distributions with `pnpm build`; never hand-edit them.
10. If policy validation changed, run `pnpm generate:schema`.
11. If decision behavior changed, update a portable fixture that proves the
   repository-facing contract.
12. If SARIF changed, prove stable IDs, ordering, and repository-relative paths.
13. Run `pnpm verify`.
14. Run the explicit `agentowners self-check` contract before opening a pull
   request.
15. For release-facing changes, run `pnpm verify:packages`.
16. For release automation, read `docs/releasing.md` and prove registry failures
    stop before mutation.
17. For Marketplace changes, prove root and packaged Action metadata remain in
    parity outside explicit distribution identity and bundle paths, then
    disclose every owner-only publication gate that remains.
18. In the pull request, disclose agent use, overlap, exact evidence, risks,
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
