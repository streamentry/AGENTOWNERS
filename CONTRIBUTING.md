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
pnpm demo
pnpm verify
```

Node.js 22+ and pnpm 9+ required.

`pnpm demo` is the fastest product proof: it builds the production packages
and runs the strict-OSS fixture suite through the public CLI. Use it to confirm
the checkout is executable before making a contribution; use `pnpm verify` for
the complete gate.

### Development workflow

1. **Find or create an issue:** all work starts with an issue
2. **Fork and branch:** `feat/my-feature` or `fix/the-bug`
3. **Write tests first:** capture the intended behavior with a failing test
4. **Run `pnpm verify`:** lint, types, build, tests, and release smoke tests
5. **Open a PR:** use a conventional-commit title and complete the evidence template

### Contribution evidence matrix

Every pull request must run `pnpm verify` and the explicit `self-check` command
above. Add the smallest focused proof for each surface the change touches:

| Change surface | Focused proof before the full gate | Additional pull-request evidence |
| --- | --- | --- |
| Policy types or schema | Focused schema test, then `pnpm generate:schema` | Commit the generated schema and show `pnpm verify:schema` passing |
| Detection, classification, actions, evaluation, or scoring | Focused unit test plus a portable fixture when repository-visible behavior changes | Name the invariant and the temporary production mutation that makes the new test fail |
| Renderer, audit JSON, or SARIF | Focused renderer or SARIF test | Prove exact ordering, stable identifiers, repository-relative paths, and redaction where applicable |
| CLI behavior | Focused CLI test using real argument parsing and exit codes | Include stdout, stderr, and exit-code boundaries; treat Git refs as hostile input |
| GitHub Action adapter | Focused Action test, then `pnpm build` | Commit the regenerated bundle and show that base-policy loading and least privilege remain intact |
| Package metadata or dependencies | `pnpm verify:packages` | Include isolated install, runtime smoke tests, and production dependency audit results |
| Example policy | Parse the policy and run its portable fixture suite | Assert exact decisions and detected actions; do not rely on prose examples |
| Documentation only | Validate every command, path, version, and link changed by the PR | State which product behavior is unchanged and cite dated primary sources for ecosystem claims |

Evidence is scoped. A green full suite does not replace the focused proof that
reaches the changed branch. A focused test does not justify a repository-wide
claim. If a required command is unavailable, report the exact limitation
instead of marking it as passed.

### Choose a contribution lane

Use the narrowest label that matches the work:

- [`good first issue`](https://github.com/streamentry/AGENTOWNERS/issues?q=is%3Aopen+label%3A%22good+first+issue%22):
  bounded examples, documentation, or tests that do not change enforcement
  semantics.
- [`help wanted`](https://github.com/streamentry/AGENTOWNERS/issues?q=is%3Aopen+label%3A%22help+wanted%22):
  scoped work with an explicit contract and acceptance criteria.
- `core-review`: changes that can alter policy decisions. A human maintainer
  must review the decision boundary and mutation evidence.
- `dependency-review`: dependency or release-supply-chain changes. Packed
  consumer verification is mandatory.
- `needs-rebase`: useful work based on stale `main`. Rebase before review
  continues; do not discard distinct evidence merely because other coverage
  landed first.

If an issue lacks a bounded contract, use
[Discussions](https://github.com/streamentry/AGENTOWNERS/discussions) before
writing code. Comment on an issue before starting substantial work when
parallel implementation is likely.

### Maintainer review contract

Every reviewed contribution should receive one explicit disposition:

1. **Approve:** the change is bounded, correct, and adequately verified.
2. **Request changes:** name the failing invariant, missing evidence, or
   compatibility risk in falsifiable terms.
3. **Rebase and retain:** identify upstream overlap and list the distinct tests,
   fixes, or documentation that remain valuable.
4. **Superseded:** link the exact commit or PR that replaced the work and state
   whether any distinct contribution remains.
5. **Out of scope:** cite the documented non-goal or roadmap boundary.

Maintainers should not close an overlapping contribution with a generic
"already fixed" response. Compare exact behavior first. Distinct tests and
failure reproductions remain valuable even when another implementation landed.
When contributor evidence materially informs a later change, preserve
attribution in the PR, commit, or release notes.

This contract governs disposition quality, not response time. Silence is not
approval, and a green test run is not proof that a contribution belongs in the
product.

### Handling overlap

Before opening a PR:

1. Refresh `origin/main`.
2. Search open and recently merged PRs for the same invariant.
3. State which behavior is new and which existing behavior is deliberately
   unchanged.
4. If upstream work lands first, rebase and remove duplicated assertions.
5. Keep distinct counterexamples, mutation-sensitive tests, and compatibility
   findings.

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
