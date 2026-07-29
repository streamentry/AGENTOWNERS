## Why

<!-- What concrete problem does this solve? Link the issue. -->

Issue:

Overlap checked:

<!-- Link related open or recently merged PRs. State what remains distinct. -->

## What changed

<!-- Keep this bounded. Name any deliberately untouched area. -->

## Evidence

<!-- Paste exact commands and concise results. Do not say "tests pass" if any were skipped. -->

- [ ] `pnpm verify`
- [ ] The explicit `agentowners self-check` ran with policy, base, head, and
      actor inputs; its exact exit code and JSON result are recorded below.
- [ ] New or changed behavior has a test that fails without the implementation
- [ ] Public API and policy changes are documented
- [ ] No secret, generated junk, or unrelated refactor is included
- [ ] Decision priority remains `block > require_approval > allow`
- [ ] Open and recently merged work was checked for overlap

## Machine-readable preflight

<!-- Keep this exact evidence in the PR so agents and maintainers share one
     reproducible policy result. Use the built CLI after `pnpm build`. -->

Command:

```text
node packages/cli/dist/index.js self-check \
  --policy .github/AGENTOWNERS.yml \
  --base origin/main \
  --head HEAD \
  --actor <agent-or-contributor>
```

Exit code (`0`, `10`, or `20` for the policy result; `64`–`70` for input or
execution errors):

Decision and recommended next action:

Required reviewers and labels:

If an Action audit artifact is part of the change, include the structured
`agentowners explain --output json` result and the verified digest. Otherwise,
write `N/A` and explain why.

## Agent disclosure

<!-- Name any coding agent used and what it produced. "None" is valid. -->

Agent:

Scope:

Human verification:

## Risk and rollback

<!-- What can fail, and what is the smallest safe rollback? -->
