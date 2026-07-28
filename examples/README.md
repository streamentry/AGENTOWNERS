# Policy examples

These policies are executable starting points, not security guarantees. Choose
the least permissive profile that matches the repository, copy it into
`.github/AGENTOWNERS.yml`, then run the validator before enabling enforcement.

## Choose a starting point

| Example | Start here when | Default posture | Main trade-off |
| --- | --- | --- | --- |
| [`minimal`](minimal/AGENTOWNERS.yml) | You are evaluating the product for the first time. | Unknown and known agents require approval; docs-only changes are allowed. | Sensitive paths are protected, but the profile is intentionally small. |
| [`strict-oss`](strict-oss/AGENTOWNERS.yml) | An open-source repository has many contributors and agent-generated PRs. | Unknown and known agents require approval; sensitive paths are blocked. | Docs-only and large changes still need an explicit review decision. |
| [`security-sensitive`](security-sensitive/AGENTOWNERS.yml) | A repository contains security, auth, permissions, or operational code. | Unknown agents and sensitive paths are blocked; docs and tests require approval. | False positives are preferable to autonomous changes in protected areas. |
| [`monorepo`](monorepo/AGENTOWNERS.yml) | Different packages have different ownership boundaries. | Unknown agents and workflows require approval or block by rule; core changes name a reviewer. | Replace the example reviewer handle with a real team before use. |
| [`dependency-bots`](dependency-bots/AGENTOWNERS.yml) | Dependabot or Renovate should update dependencies without unrestricted privilege. | Dependency updates require approval; workflows, auth, permissions, and secrets are blocked. | The example covers two bots; add every trusted updater explicitly. |

## Validate every example

From the repository root, build the local CLI and validate the policies:

```bash
pnpm install --frozen-lockfile
pnpm build

for profile in minimal strict-oss security-sensitive monorepo dependency-bots; do
  node packages/cli/dist/index.js validate "examples/$profile/AGENTOWNERS.yml"
done
```

The `strict-oss` example also includes a portable executable contract:

```bash
node packages/cli/dist/index.js test \
  --policy examples/strict-oss/AGENTOWNERS.yml \
  --fixtures examples/strict-oss/AGENTOWNERS.fixtures.yml
```

## Adopt one safely

1. Copy one policy into `.github/AGENTOWNERS.yml`; do not edit the example in
   place.
2. Replace reviewer handles such as `@core-maintainers` with identities that
   GitHub can actually request.
3. Run `agentowners check --base main --head HEAD --mode advisory` on a sample
   range and inspect the verdicts.
4. Start the GitHub Action in comment-only or check mode. Enforce only after
   reviewing false positives and configuring branch protection for the check.

The profiles do not establish agent identity, replace branch protection, or
make human review optional. Their purpose is to make the first policy decision
explicit, deterministic, and reviewable.
