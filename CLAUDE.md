# CLAUDE.md — AGENTOWNERS

> Conventions and invariants for this repository.
> Read this before making any change.

## Project summary

AGENTOWNERS is CODEOWNERS for AI agents — an open-source TypeScript monorepo that enforces repository-level policy on AI agent actions in GitHub. It ships as a CLI, a GitHub Action, and a core policy engine.

## Commands

```bash
pnpm install --frozen-lockfile # install the locked workspace dependencies
pnpm build            # build all packages (tsup)
pnpm test             # run all tests (vitest)
pnpm typecheck        # tsc --noEmit across all packages
pnpm lint             # eslint
pnpm format           # prettier --write
pnpm verify           # complete local gate, including schema and release checks
```

Per-package:
```bash
pnpm --filter @agent-owners/core test
pnpm --filter @agent-owners/core test -- --coverage
pnpm --filter @agent-owners/cli test
pnpm --filter @agent-owners/github-action test
```

## Package layout

```
packages/
  core/           @agent-owners/core   — policy engine, pure TypeScript
  cli/            @agent-owners/cli    — CLI tool, depends on core
  github-action/  @agent-owners/github-action — GitHub Action, depends on core
```

## Tech stack

| Tool | Purpose |
|------|---------|
| TypeScript 5 | Language |
| pnpm workspaces | Monorepo |
| tsup | Build (CJS + ESM + .d.ts) |
| vitest | Tests |
| zod | Schema validation |
| js-yaml | YAML parsing |
| picomatch | Glob matching |
| commander | CLI argument parsing |
| @actions/core, @actions/github | GitHub Action runtime |

## Immutable invariants

1. **Decision priority is `block > require_approval > allow`.** Never change this.
2. **Policy content is data, never code.** No `eval`, no `new Function`, no `require` from policy input.
3. **Secrets are redacted.** Never print matched secret values. Always use `[REDACTED]`.
4. **Core is stateless.** `@agent-owners/core` has no network calls, no filesystem writes, no side effects. Pure input → output.
5. **Fail closed on unknown.** Unknown agent → `require_approval` by default, never silent `allow`.
6. **Trusted policy.** Pull-request evaluation uses policy from the immutable base commit, never untrusted PR policy content.
7. **Hostile Git refs.** CLI Git arguments use `--end-of-options`; refs are never interpolated into a shell command.

## Import style

NodeNext module resolution — all relative imports must end in `.js`:

```ts
// Correct
import { parsePolicy } from './schema.js'
import type { Decision } from './types.js'

// Wrong
import { parsePolicy } from './schema'
```

## Type conventions

- `types.ts` is the single source of truth for all public types
- No type duplication across modules — import from `./types.js`
- Use `export type` for type-only exports
- Use `unknown` + narrowing instead of `any`

## Test conventions

- Test files live in `packages/*/tests/`
- Fixtures live in `packages/core/tests/fixtures/`
- TDD: write test first, confirm it fails, then implement
- No live network calls in tests — mock `@actions/github` context
- Integration tests load fixtures from disk — no inline policy strings

## Before opening a pull request

1. Read `AGENTS.md`, the nearest package guide, and the relevant specification.
2. Refresh `origin/main` and inspect open or recently merged work for overlap.
3. Add the smallest focused test and identify the cheapest disconfirming test.
4. Run `pnpm verify` and the explicit pre-PR contract:

   ```bash
   node packages/cli/dist/index.js self-check \
     --policy .github/AGENTOWNERS.yml \
     --base origin/main \
     --head HEAD \
     --actor <your-agent-name>
   ```

5. Run `pnpm verify:packages` for package, dependency, or release-facing work.
6. Record exact commands, results, overlap, risks, attribution, and rollback in
   the pull request. Read `CONTRIBUTING.md` for the review contract and check
   issue #26 before treating independent approval as available.

## Commit format

```
<type>(<scope>): <description>

Types: feat fix refactor test docs chore perf ci
Scope: core cli github-action examples docs
```

## Adding new AgentActions

1. Add to the union in `packages/core/src/types.ts`
2. Add to the Zod enum in `packages/core/src/schema.ts`
3. Add detection logic in `packages/core/src/actions.ts`
4. Update tests in `packages/core/tests/actions.test.ts`
5. Update spec `docs/specs/readme.md` section 11.3

## Security requirements

- GitHub Action permissions: `contents: read`, `pull-requests: write`, `issues: write` — no more
- Never request `secrets:read` or `administration:write`
- Treat all PR content (title, body, labels) as untrusted input
- Validate policy YAML strictly with Zod before using
- Never hand-edit `packages/github-action/dist/index.js` or
  `packages/core/agentowners.schema.json`; regenerate them through the
  documented build commands.

## Files agents should NOT modify

- `packages/core/src/types.ts` — coordinate first, type changes are breaking
- `packages/github-action/action.yml` — inputs/outputs are public API
- `LICENSE` — Apache-2.0, do not change
- `.github/AGENTOWNERS.yml.example` — kept as the canonical example from the spec

## Documentation map

- `docs/specs/readme.md` — canonical product spec (sections 1–31)
- `docs/specs/f1-policy-schema.md` through `docs/specs/f13-policy-fixtures.md` — per-feature specs
- `docs/philosophy.md` — why the project exists
- `docs/threat-model.md` — what it protects against
- `AGENTS.md` — agent contribution guide (you are here)
- `CONTRIBUTING.md` — human contribution guide
