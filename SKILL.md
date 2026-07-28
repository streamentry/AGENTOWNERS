---
name: contribute-agentowners
description: Implement or review deterministic AI-agent governance changes in AGENTOWNERS
---

# Contribute to AGENTOWNERS

1. Read `AGENTS.md`, the nearest package `AGENTS.md`, and the relevant spec.
2. Refresh `origin/main`; inspect open and recently merged work for overlap.
3. State the invariant, expected behavior, and any distinct value retained from
   related contributions.
4. From a fresh checkout, run `pnpm install --frozen-lockfile` and
   `pnpm --filter @agent-owners/cli build` before invoking the CLI self-check;
   `packages/*/dist/` is generated and intentionally ignored.
   For a fast product proof, `pnpm demo` builds the production CLI and runs the
   strict-OSS approval, block, and dependency-review fixtures.
5. Use the contribution evidence matrix in `CONTRIBUTING.md` to select the
   focused proof required for every touched surface.
6. For ecosystem or positioning claims, use dated official sources and state
   what AGENTOWNERS does not control.
7. Keep pull request and issue metadata in distinct evaluator fields so
   event-specific conditions cannot match the wrong event type.
8. Add the cheapest disconfirming test first.
9. Implement the smallest complete change.
10. For a safety invariant, prove the new test fails under a temporary relevant
   mutation, then restore production code exactly.
11. Regenerate distributions with `pnpm build`; never hand-edit them.
12. If policy validation changed, run `pnpm generate:schema`.
13. If decision behavior changed, update a portable fixture that proves the
   repository-facing contract.
14. If SARIF changed, prove stable IDs, ordering, and repository-relative paths.
15. Run `pnpm verify`.
16. Run the explicit `agentowners self-check` contract before opening a pull
   request.
17. For release-facing changes, run `pnpm verify:packages`.
18. For documentation-only changes, run `pnpm verify:docs` and use the pull
   request template's focused-evidence fields.
19. When agent detection uses commit metadata, labels, titles, or bodies, keep
   `identityTrust: unverified` separate from `confirmed` detection confidence;
   unverified evidence must not grant privileged allow decisions.
20. When a rule scopes on `actions`, allow only when the condition enumerates
   every detected action; preserve any-action matching for block and approval.
21. When changing CLI audit rendering, validate the complete decision shape and
   strip terminal control sequences before printing untrusted text.
22. In the pull request, disclose agent use, overlap, exact evidence, risks,
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
