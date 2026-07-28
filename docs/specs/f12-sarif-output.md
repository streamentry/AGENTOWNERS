# F12: Deterministic SARIF output

## Objective

Expose non-allow AGENTOWNERS decisions as standards-compatible SARIF 2.1.0
without weakening the deterministic policy boundary.

## Public API

```ts
renderSarif(decision: Decision): SarifLog
```

The core renderer is pure. It reads only the supplied decision and never reads
the clock, filesystem, Git, environment variables, or network.

The CLI exposes it through:

```bash
agentowners check --base <ref> --head <ref> --output sarif
```

## Decision mapping

| Decision           |                              SARIF results | SARIF level |
| ------------------ | -----------------------------------------: | ----------- |
| `allow`            |                                          0 | none        |
| `require_approval` | one per non-allow rule and safe matched file | rule effect |
| `block`            | one per non-allow rule and safe matched file | rule effect |

Rules requiring approval emit `warning`; blocking rules emit `error`. When no
matched rule explains the final non-allow effect, such as a block from defaults
or an agent action list, emit an additional `AGENTOWNERS/DEFAULT` result.

## Stability contract

- `version` is exactly `2.1.0`.
- `$schema` is `https://json.schemastore.org/sarif-2.1.0.json`.
- Rule IDs are opaque deterministic hashes of policy rule names.
- Partial fingerprints bind the rule ID to its repository-relative file.
- Rules, results, actions, reviewers, and files have deterministic ordering.
- Output contains no timestamps, random values, commit-specific identifiers, or
  absolute workspace paths.

Changing the order of matched rules or files must not change the output.

## Location safety

`artifactLocation.uri` contains a URI-encoded repository-relative path.
Absolute POSIX paths, Windows drive paths, backslashes, NUL bytes, empty
segments, `.` segments, and parent traversal are omitted. The policy result
remains present without a location so malformed input cannot erase a block or
approval decision.

## CLI failures

`check --output` accepts only `text`, `json`, or `sarif`. An unsupported format
prints a bounded error, exits `64`, and performs no Git read or evaluation.

## Tests

- exact SARIF version and schema
- deterministic output
- clean allow result set
- approval and block severity
- stable opaque IDs and partial fingerprints
- one result per safe matched file
- URI encoding and unsafe-path omission
- default-result fallback
- ordering invariance
- CLI SARIF serialization and invalid-format failure
