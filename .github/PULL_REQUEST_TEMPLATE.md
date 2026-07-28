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
- [ ] New or changed behavior has a test that fails without the implementation
- [ ] Public API and policy changes are documented
- [ ] No secret, generated junk, or unrelated refactor is included
- [ ] Decision priority remains `block > require_approval > allow`
- [ ] Open and recently merged work was checked for overlap

## Agent disclosure

<!-- Name any coding agent used and what it produced. "None" is valid. -->

Agent:

Scope:

Human verification:

## Risk and rollback

<!-- What can fail, and what is the smallest safe rollback? -->
