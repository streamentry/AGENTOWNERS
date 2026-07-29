# F11: Agent Self-Check Contract

## Objective

Provide a deterministic, machine-readable preflight for an agent before it
opens or updates a pull request.

## Command

```bash
agentowners self-check \
  --policy .github/AGENTOWNERS.yml \
  --base origin/main \
  --head HEAD \
  --actor coding-agent[bot] \
  --output-version 1
```

`--policy`, `--base`, `--head`, and `--actor` are mandatory. Self-check never
infers these values from GitHub, environment variables, local identity, or
other hidden state.

## Success output

The command writes one JSON document to stdout:

```json
{
  "schemaVersion": 1,
  "status": "complete",
  "inputs": {
    "policy": ".github/AGENTOWNERS.yml",
    "base": "origin/main",
    "head": "HEAD",
    "actor": "coding-agent[bot]"
  },
  "policyDigest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "decision": "require_approval",
  "risk": {
    "score": 45,
    "level": "medium"
  },
  "detectedActions": ["modify_tests"],
  "blockedActions": [],
  "matchedRules": [],
  "requiredReviewers": ["maintainers"],
  "recommendedNextAction": "request_approval"
}
```

`blockedActions` contains all detected actions when the evaluated change is
blocked. It is empty for `allow` and `require_approval`. This describes the
change-set decision, not an independent per-action policy evaluation.

`recommendedNextAction` is one of:

- `proceed` for `allow`
- `request_approval` for `require_approval`
- `revise_changes` for `block`

The recommendation is advisory data. The command never edits files, commits,
opens pull requests, contacts GitHub, or merges.

`policyDigest` is the lowercase SHA-256 fingerprint produced by the core
canonicalization contract. It binds the decision evidence to the exact policy
content after YAML formatting and comments are normalized. It does not prove
policy authorship, approval, or repository authenticity.

## Error output

Failures write one JSON document to stderr:

```json
{
  "schemaVersion": 1,
  "status": "error",
  "error": {
    "code": "INVALID_POLICY",
    "message": "Unable to load or validate the policy."
  },
  "recommendedNextAction": "fix_policy"
}
```

Stable error codes:

| Code | Meaning | Recommendation |
|------|---------|----------------|
| `INVALID_INPUT` | A mandatory option is absent or empty | `fix_inputs` |
| `UNSUPPORTED_OUTPUT_VERSION` | `--output-version` is not `1` | `upgrade_integration` |
| `INVALID_POLICY` | Policy file cannot be read or validated | `fix_policy` |
| `INVALID_GIT_RANGE` | Base or head ref cannot be resolved | `fix_git_range` |
| `INTERNAL_ERROR` | An unexpected failure escaped a bounded operation | `report_error` |

Error messages never include policy contents, diffs, credentials, or matched
secret values.

## Exit codes

| Exit | Meaning |
|------|---------|
| `0` | Decision is `allow` |
| `10` | Decision is `require_approval` |
| `20` | Decision is `block` |
| `64` | Invalid input or unsupported output version |
| `65` | Policy load or validation failure |
| `66` | Git range failure |
| `70` | Unexpected internal failure |

Every non-allow outcome is nonzero. Integrations must inspect both the exit
code and `schemaVersion`.

## Determinism and security

- Git refs are passed as subprocess arguments and never through a shell.
- The command makes no model, network, or GitHub API calls.
- The same repository, policy, refs, and actor produce the same JSON.
- Success output includes the canonical digest of the policy used for evaluation.
- JSON contains no timestamp, random identifier, or machine-specific absolute
  path.
- Unknown output versions fail closed.
