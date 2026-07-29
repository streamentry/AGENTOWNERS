# F16: Fail-closed Action mode input

## Contract

The root and package Action metadata document exactly four modes:

```text
comment | check | both | dry-run
```

An empty input uses the documented default, `comment`. Any other non-empty
value is invalid and MUST fail the Action before it creates a GitHub client,
reads a token, loads repository content, posts comments, applies labels, or
writes an audit artifact.

The accepted modes retain their existing behavior:

- `comment`: post/update the verdict comment and apply labels;
- `check`: evaluate and expose outputs without posting a comment;
- `both`: post/update the verdict comment, apply labels, and expose outputs;
- `dry-run`: evaluate and expose outputs without comments or labels.

## Security rationale

Treating an unknown mode as a partial mode creates an ambiguous side-effect
boundary. A typo must not silently disable comments, labels, or enforcement.
Failing before token/API access makes the configuration error deterministic and
safe to diagnose.

## Tests

`packages/github-action/tests/config.test.ts` covers every accepted mode, the
empty-input default, and a representative unsupported value. The Action test
suite continues to cover dry-run, comment, and approval/failure behavior.
