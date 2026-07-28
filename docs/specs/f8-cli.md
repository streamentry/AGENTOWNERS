# F8: CLI Commands

## Objective
Implement the `agentowners` CLI commands: init, validate, check, explain,
fingerprint, and self-check.

## Package
`packages/cli/src/`

## Entry point
`packages/cli/src/index.ts` — uses `commander`

## Commands

### `agentowners init`
Creates `.github/AGENTOWNERS.yml` from a profile.

Options:
- `--profile <name>` — `minimal` (default), `strict-oss`, `security-sensitive`
- `--output <path>` — output path (default: `.github/AGENTOWNERS.yml`)
- `--force` — overwrite if exists

Behavior:
- Create output directory if needed
- Write profile content from `packages/core/src/profiles.ts`
- Print success message with path

### `agentowners validate [path]`
Validates a policy file.

Default path: `.github/AGENTOWNERS.yml` (resolution order)

Output on success:
```
AGENTOWNERS policy valid.
```

Output on error:
```
Invalid AGENTOWNERS policy:
- rules[0].effect must be one of allow, require_approval, block
- agents.copilot.match.actors must be an array of strings
```

Exit code: 0 on success, 1 on validation error.

### `agentowners check`
Analyzes changed files against policy.

Options:
- `--policy <path>` — policy file path
- `--base <ref>` — git base ref (default: `main`)
- `--head <ref>` — git head ref (default: `HEAD`)
- `--actor <name>` — actor name (for agent detection)
- `--output <format>` — `text` (default) or `json`
- `--mode <mode>` — `advisory` | `enforcement` | `dry-run`

Behavior:
1. Load policy
2. Get changed files via `git diff --name-only <base> <head>`
3. Classify files
4. Infer actions
5. Detect agent (from actor flag + git log)
6. Evaluate policy
7. Render verdict

Exit codes:
- 0 — allow or require_approval (advisory/dry-run)
- 1 — block (enforcement mode)
- 0 — all decisions (advisory/dry-run mode)

### `agentowners explain`
Explains a decision from a JSON file.

Options:
- `--decision <path>` — path to decision JSON file

Output: Human-readable explanation of how the decision was reached.

### `agentowners fingerprint`
Detects agent signals in a commit or local git state.

Options:
- `--commit <ref>` — analyze a specific commit (default: HEAD)
- `--output <format>` — `text` | `json`

Output:
```

### `agentowners self-check`

Provides the versioned, machine-readable pre-PR contract defined in
`docs/specs/f11-agent-self-check.md`. Policy, base, head, and actor are explicit
inputs. The command never calls a model, network, or GitHub API.
Agent detection result:
  Confidence: likely
  Signals:
    - Commit message contains "Co-Authored-By: Claude"
    - PR body contains "🤖 Generated with"
```

## Implementation Notes
- Use `commander` for argument parsing
- Use `chalk` or `picocolors` for colored output
- Exit code handling via `process.exit()`
- All git operations via `child_process.execSync` or `execa`
- Never run shell commands from policy content (security)

## Files
- `packages/cli/src/index.ts` — entry, commander setup
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/validate.ts`
- `packages/cli/src/commands/check.ts`
- `packages/cli/src/commands/explain.ts`
- `packages/cli/src/commands/fingerprint.ts`
- `packages/cli/src/commands/self-check.ts`
- `packages/cli/src/git.ts` — git helper functions
- `packages/cli/tests/` — unit tests for each command

## Tests
- `init` creates file with correct profile content
- `init` with `--force` overwrites existing file
- `validate` exits 0 on valid policy
- `validate` exits 1 with error messages on invalid policy
- `check` returns correct exit code by mode
- `fingerprint` detects Co-Authored-By signals
- `self-check` covers every public exit code and hostile Git refs
