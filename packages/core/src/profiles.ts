// Policy profiles — spec section 18

export const PROFILES: Record<string, string> = {
  minimal: `version: 1

defaults:
  known_agent: require_approval
  unknown_agent: require_approval
  docs_only: allow
  workflows: block
  secrets: block

rules:
  - name: "Allow docs-only changes"
    when:
      docs_only: true
    effect: allow
    reason: "Docs-only changes are low risk."

  - name: "Block workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "Agents may not modify GitHub Actions workflows."

  - name: "Require approval for dependency changes"
    when:
      changes_package_files: true
    effect: require_approval
    reason: "Dependency changes require maintainer review."
`,

  'strict-oss': `version: 1

defaults:
  known_agent: require_approval
  unknown_agent: require_approval
  docs_only: require_approval
  workflows: block
  secrets: block

rules:
  - name: "Block sensitive paths"
    when:
      files:
        - ".github/workflows/**"
        - ".github/actions/**"
        - "**/auth/**"
        - "**/security/**"
        - "**/permissions/**"
        - "infra/**"
        - "terraform/**"
        - "k8s/**"
    effect: block
    reason: "Agents may not modify sensitive operational or security paths."

  - name: "Require approval for large diffs"
    when:
      diff_lines_over: 300
    effect: require_approval
    reason: "Large AI-generated diffs are hard to review safely."

  - name: "Require approval for dependencies"
    when:
      changes_package_files: true
    effect: require_approval
    reason: "Dependency changes can affect supply-chain risk."
`,

  'security-sensitive': `version: 1

defaults:
  known_agent: require_approval
  unknown_agent: block
  docs_only: require_approval
  workflows: block
  secrets: block

rules:
  - name: "Block unknown agents"
    when:
      agents:
        - "unknown"
    effect: block
    reason: "Unknown agents cannot act in this repository."

  - name: "Block all workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "CI/CD workflows must be edited by humans."

  - name: "Block auth/security edits"
    when:
      files:
        - "**/auth/**"
        - "**/security/**"
        - "**/permissions/**"
    effect: block
    reason: "Security-sensitive code must be changed by accountable humans."

  - name: "Require approval for test changes"
    when:
      files:
        - "**/*.test.*"
        - "**/*.spec.*"
        - "tests/**"
    effect: require_approval
    reason: "Agents may weaken tests accidentally."
`,

  monorepo: `version: 1

defaults:
  unknown_agent: require_approval
  known_agent: require_approval
  workflows: block
  secrets: block

rules:
  - name: "Allow docs-only changes in any package"
    when:
      docs_only: true
    effect: allow
    reason: "Docs are low risk."

  - name: "Block workflow edits"
    when:
      files:
        - ".github/workflows/**"
    effect: block
    reason: "Workflows must be changed by humans."

  - name: "Require approval for packages/core changes"
    when:
      files:
        - "packages/core/**"
    effect: require_approval
    reviewers:
      - "@core-maintainers"
    reason: "Core package changes need careful review."

  - name: "Require approval for dependency changes"
    when:
      changes_package_files: true
    effect: require_approval
    reason: "Dependency changes affect supply-chain risk."
`,

  'dependency-bots': `version: 1

agents:
  dependabot:
    match:
      actors:
        - "dependabot[bot]"
    allowed:
      - open_pr
      - update_pr
    requires_approval:
      - modify_dependencies
    blocked:
      - edit_workflows
      - modify_auth
      - change_permissions
      - touch_secrets

  renovate:
    match:
      actors:
        - "renovate[bot]"
    allowed:
      - open_pr
      - update_pr
    requires_approval:
      - modify_dependencies
    blocked:
      - edit_workflows
      - modify_auth
      - change_permissions
      - touch_secrets

defaults:
  known_agent: require_approval
  unknown_agent: block
  docs_only: require_approval
  workflows: block
  secrets: block
`,
};

export const PROFILE_NAMES = Object.freeze(Object.keys(PROFILES));

export function getProfile(name: string): string | null {
  return PROFILES[name] ?? null;
}
