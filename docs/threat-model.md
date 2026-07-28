# Threat Model

## What AGENTOWNERS protects against

### 1. Unauthorized workflow modification
**Threat**: An AI agent modifies `.github/workflows/` to inject malicious steps or exfiltrate secrets.  
**Protection**: Default `workflows: block`. Rule matching `.github/workflows/**` → `effect: block`.

### 2. Dependency confusion / supply chain attacks
**Threat**: An agent upgrades or adds dependencies that introduce malicious code.  
**Protection**: `changes_package_files: true` → `effect: require_approval`. Human review required.

### 3. Auth/permission escalation
**Threat**: An agent modifies auth middleware, RBAC configs, or permission checks to broaden access.  
**Protection**: Auth paths (`**/auth/**`, `**/security/**`, `**/permissions/**`) default to `require_approval`.

### 4. Secret exfiltration via diff
**Threat**: A PR diff contains secrets in added lines.  
**Protection**: Secret pattern detection in available GitHub patch content.
Patterns are never emitted. File names like `.env` are also flagged. GitHub
may omit patches for binary or oversized changes, so this is a guardrail, not
a substitute for dedicated secret scanning.

For renamed files, the Action retains both GitHub's destination `filename` and
the source `previous_filename`. This prevents a rename from erasing a sensitive
source-path classification when patch content is unavailable.

GitHub limits the pull-request files endpoint to 3,000 files. The Action binds
pagination to the pull request's declared `changed_files` count, rejects
declared counts above that ceiling, and rejects list/metadata mismatches.
Exactly 3,000 files are accepted only when the declared count proves the final
full page is complete.

### 5. Impersonation of non-agent actors
**Threat**: An agent claims to be a human contributor to bypass policy.  
**Protection**: Configured actor matches produce confirmed identity. Spoofable
body and commit markers remain unconfirmed and receive the unknown-agent
default.

### 6. Policy injection via PR content
**Threat**: A malicious PR body contains instructions that change how AGENTOWNERS evaluates the policy.  
**Protection**: PR content is used for pattern matching only. It is never
executed, evaluated, or interpreted as policy. For pull requests and reviews,
the policy is fetched from the immutable base commit, so a pull request cannot
rewrite the policy that judges itself.

### 8. Git option injection
**Threat**: An attacker-controlled ref beginning with `-` is interpreted as a
Git option even though the CLI uses an argv subprocess API.
**Protection**: Git ranges are placed after `--end-of-options`, and pathspec
arguments use the explicit `--` separator.

### 7. Privilege escalation via GitHub Action
**Threat**: The AGENTOWNERS action itself is used to perform unauthorized operations.  
**Protection**: Minimum required permissions (`contents: read`, `pull-requests: write`, `issues: write`). No `secrets:read`, no `administration:write`.

## What AGENTOWNERS does NOT protect against

### 1. Sophisticated supply chain attacks
AGENTOWNERS detects dependency file changes and flags them for review. It does not analyze the content of `package.json` or `requirements.txt` for malicious packages.

### 2. Agents that bypass the Action entirely
AGENTOWNERS is a GitHub Action. An agent that directly calls the GitHub API without triggering the action (e.g., via a personal access token) is not subject to AGENTOWNERS checks.

### 3. Code quality or correctness
AGENTOWNERS does not review the correctness of code — only the policy around what changes may be made.

### 4. Insider threats
A human contributor with write access can disable or modify AGENTOWNERS policy. This is by design — maintainers are trusted.

### 5. Zero-day vulnerabilities in dependencies
AGENTOWNERS does not audit dependency security — use a dedicated tool (Dependabot, Snyk, etc.) for that.

## Advisory mode vs enforcement mode

**Advisory mode** (default): AGENTOWNERS posts a verdict but never fails CI. Appropriate for:
- First-time installation
- Teams learning what policy to set
- Repositories where CI blocking is high-risk

**Enforcement mode**: AGENTOWNERS fails CI on `block` decisions. Appropriate for:
- Established policy that has been tuned in advisory mode
- High-risk repositories (security-sensitive, production-critical)
- Organizations with clear AI agent policies

The recommended path: start in advisory mode, read the verdicts for 1–2 weeks, tune your policy, then switch to enforcement.
