# Contributing to AGENTOWNERS

## For AI agents

Read [AGENTS.md](AGENTS.md) first. It has everything you need: repo map,
invariants, commands, and common mistakes. Before opening a pull request, run:

```bash
node packages/cli/dist/index.js self-check \
  --policy .github/AGENTOWNERS.yml \
  --base origin/main \
  --head HEAD \
  --actor <your-agent-name>
```

Exit `0` may proceed, exit `10` requires human approval, and exit `20` requires
revising the change. Input and environment failures use exits `64` through
`70`; the complete contract is in
[F11](docs/specs/f11-agent-self-check.md).

## For humans

### Setup

```bash
git clone https://github.com/streamentry/AGENTOWNERS.git
cd AGENTOWNERS
pnpm install
pnpm verify
```

Node.js 22+ and pnpm 9+ required.

### Development workflow

1. **Find or create an issue:** all work starts with an issue
2. **Fork and branch:** `feat/my-feature` or `fix/the-bug`
3. **Write tests first:** capture the intended behavior with a failing test
4. **Run `pnpm verify`:** lint, types, build, tests, and release smoke tests
5. **Open a PR:** use a conventional-commit title and complete the evidence template

### Commit format

```
feat(core): add SARIF output format to renderer
fix(cli): handle missing policy file gracefully
test(core): add coverage for secrets detection edge cases
docs: update policy reference for diff_lines_over condition
```

Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf` `ci`  
Scopes: `core` `cli` `github-action` `examples` `docs`

### Adding a new policy profile

1. Add YAML string to `packages/core/src/profiles.ts`
2. Add example to `examples/<name>/AGENTOWNERS.yml`
3. Add `--profile <name>` to `packages/cli/src/commands/init.ts`
4. Add test to `packages/core/tests/profiles.test.ts`

### Adding a new AgentAction

1. Add to union in `packages/core/src/types.ts`
2. Add to Zod enum in `packages/core/src/schema.ts`
3. Add detection logic in `packages/core/src/actions.ts`
4. Update tests in `packages/core/tests/actions.test.ts`
5. Update `docs/specs/readme.md` section 11.3

### Adding an adversarial fixture

1. Read `packages/core/tests/fixtures/README.md`
2. Name the invariant and exact expected outcome
3. Add the smallest deterministic case to `adversarial-corpus.json`
4. Prove the case fails under a temporary relevant production mutation
5. Restore production code and run `pnpm verify`

If the case reveals incorrect production behavior, open and fix a separate bug
before changing the fixture expectation.

### Code style

- Functions: < 50 lines
- Files: < 800 lines
- No `any`; use `unknown` and narrow safely
- No mutation; return new objects
- Import paths end in `.js` (NodeNext)
- No `console.log` in library code

### Security

Report vulnerabilities through
[GitHub private security advisories](https://github.com/streamentry/AGENTOWNERS/security/advisories/new).
Never disclose vulnerability details in a public issue.

See [SECURITY.md](SECURITY.md) for full policy.

### PR checklist

- [ ] Full verification passes (`pnpm verify`)
- [ ] New functionality has tests
- [ ] Decision priority invariant preserved (`block > require_approval > allow`)
- [ ] No secrets or tokens committed
- [ ] No shell execution from policy content
