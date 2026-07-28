# AGENTOWNERS contributor instructions

Read [`AGENTS.md`](../AGENTS.md) before changing code. It is the canonical
repository map and safety contract.

- Preserve `block > require_approval > allow`.
- Treat policies, GitHub event text, file paths, and Git refs as untrusted input.
- Never print matched secret values.
- Keep `@agent-owners/core` deterministic and free of network or database calls.
- Add or update a failing test before changing behavior.
- Run `pnpm verify` before declaring work complete.
- Include the exact commands and results in the pull request.

Good contributions are narrow, evidence-backed, and complete. Do not bundle
unrelated cleanup with a feature or fix.
