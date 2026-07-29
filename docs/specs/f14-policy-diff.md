# F14: Deterministic policy diff

## Purpose

`agentowners policy-diff` gives maintainers and coding agents a safe review
primitive for policy changes. It compares two valid `AGENTOWNERS` policies
without printing policy values, which may contain sensitive paths, actor names,
or operational rationale.

## Core contract

`diffPolicies(base, proposed)` parses both inputs with the canonical policy
schema and returns:

```ts
{
  schemaVersion: 1,
  baseDigest: string,       // SHA-256 of canonical policy data
  proposedDigest: string,   // SHA-256 of canonical policy data
  identical: boolean,
  changes: Array<{
    path: string,            // JSON Pointer path, values never included
    kind: 'added' | 'removed' | 'changed'
  }>
}
```

Canonicalization sorts object keys, preserves array order, ignores explicitly
undefined optional object fields, and ignores YAML formatting and comments.
Policy values are never included in the diff result.
Paths use JSON Pointer escaping (`~` becomes `~0`, `/` becomes `~1`). Changes
are sorted by path and kind, so equivalent inputs produce byte-stable output.

`hashPolicy(policy)` exposes the canonical SHA-256 fingerprint for external
attestation. A digest proves content equivalence after canonicalization; it
does not prove authorship or approval.

## CLI contract

```bash
agentowners policy-diff \
  --base .github/AGENTOWNERS.yml \
  --proposed /tmp/AGENTOWNERS.yml \
  --format json \
  --fail-on-change
```

The JSON result is wrapped as `{ schemaVersion: 1, status: 'complete', diff }`.
Text output prints only the two digests and changed paths. Without
`--fail-on-change`, valid differences exit `0`; with it, differences exit `1`.
Invalid command input exits `64`, invalid policy input exits `65`, and
unexpected failures exit `70`. Error output is generic and never echoes policy
content or absolute paths.

## Security boundaries

- The core function is pure and performs no filesystem, network, shell, clock,
  or persistent-state operations.
- The CLI reads only the two explicitly named policy files.
- The diff is evidence of structural change, not a policy decision and not a
  replacement for `self-check`, `check`, or independent human review.
