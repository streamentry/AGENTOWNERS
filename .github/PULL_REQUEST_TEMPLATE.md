## Why

<!-- What concrete problem does this solve? Link the issue. -->

Issue:

Overlap checked:

<!-- Link related open or recently merged PRs. State what remains distinct. -->

## What changed

<!-- Keep this bounded. Name any deliberately untouched area. -->

## Review routing

<!-- Select the narrowest existing label that matches the changed files. -->

- Review lane: `core-review` | `security-review` | `dependency-review` | `governance` | `documentation`
- [ ] I added the narrowest matching review-lane label, or explained in the PR why none applies.
- [ ] I checked the [review queues](https://github.com/streamentry/AGENTOWNERS/pulls?q=is%3Apr+is%3Aopen) for overlapping work.

## Evidence

<!-- Paste exact commands and concise results. Do not say "tests pass" if any were skipped. -->

- [ ] `pnpm verify`
- [ ] `agentowners self-check` was run against the immutable `origin/main` base
      and the current head; include its decision and exit code below.
- [ ] New or changed behavior has a test that fails without the implementation
- [ ] Public API and policy changes are documented
- [ ] No secret, generated junk, or unrelated refactor is included
- [ ] Decision priority remains `block > require_approval > allow`
- [ ] Open and recently merged work was checked for overlap
- [ ] If documentation or links changed, `pnpm verify:docs` passes.
- [ ] If packages or release artifacts changed, `pnpm verify:packages` passes.

Self-check result:

<!-- Paste the compact JSON decision and exit code. A require_approval result is
not a failure; it is an explicit human-review requirement. -->

Focused evidence:

<!-- Name the focused test, fixture, mutation, or command that reaches the
changed branch. Full-suite green is not a substitute for this proof. -->

## Agent disclosure

<!-- Name any coding agent used and what it produced. "None" is valid. -->

Agent:

Scope:

Human verification:

## Risk and rollback

<!-- What can fail, and what is the smallest safe rollback? -->
