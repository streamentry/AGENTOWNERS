# F15: Policy-bound audit evidence

## Problem

An Action audit file can be byte-verified without proving which policy produced
the decision. The Action already loads policy from a trusted repository ref;
that provenance must survive in the evidence it emits.

## Contract

When a caller has policy provenance, `renderAuditJson()` MAY receive:

- `policyDigest`: the lowercase SHA-256 digest returned by `hashPolicy()` after
  canonical policy parsing;
- `policyRef`: the trusted Git ref used to load the policy.

The renderer includes those fields in the version-1 audit record only when they
are supplied. Existing callers that omit them retain the prior output shape.

The GitHub Action MUST:

1. load the policy through its existing trusted-ref path;
2. compute the canonical digest from the parsed policy, never from raw YAML;
3. expose `policy-digest` and `policy-ref` outputs;
4. include the same values in `agentowners-decision.json`.

For pull requests, `policy-ref` is the immutable base SHA. For issue and issue
comment events, it is the repository default-branch ref; the digest remains the
content binding for the exact policy evaluated at that invocation.

## Security boundaries

- A digest proves canonical content equivalence, not authorship, signature, or
  approval.
- A ref is provenance context, not an immutable guarantee for a branch name.
- No policy value, secret match, or raw event content is added to the output.
- The core renderer remains pure; the Action remains the only adapter that
  resolves a trusted repository ref.

## Tests

- Core renderer preserves optional policy fields and omits them by default.
- Action policy helpers bind the canonical digest to the selected ref.
- Action integration asserts both outputs and the audit context.
- `pnpm verify:release` proves root/package Action metadata parity.
