# Policy examples

Each directory contains a complete `AGENTOWNERS.yml` that can be copied into a
repository and then adapted. Start with the least restrictive profile that
matches the repository's risk, and keep sensitive paths fail-closed.

| Example | Default posture | Best starting point |
| --- | --- | --- |
| [`minimal`](minimal/AGENTOWNERS.yml) | Docs may proceed; dependencies require approval; workflows and secrets block | A new repository learning the contract |
| [`strict-oss`](strict-oss/AGENTOWNERS.yml) | Docs and dependencies require approval; sensitive paths block; large diffs require approval | Most open-source projects |
| [`security-sensitive`](security-sensitive/AGENTOWNERS.yml) | Unknown agents, workflows, secrets, auth, and permission paths block | Security-critical repositories |
| [`monorepo`](monorepo/AGENTOWNERS.yml) | Package-scoped review plus repository-wide sensitive-path defaults | Multi-package repositories |
| [`dependency-bots`](dependency-bots/AGENTOWNERS.yml) | Dependabot and Renovate are identified explicitly; privileged actions block | Repositories using automated dependency PRs |

## Copy and validate

```bash
mkdir -p .github
cp examples/strict-oss/AGENTOWNERS.yml .github/AGENTOWNERS.yml
agentowners validate .github/AGENTOWNERS.yml
```

The `strict-oss` example includes a portable fixture suite. Run it through the
same public contract used in CI:

```bash
agentowners test \
  --policy examples/strict-oss/AGENTOWNERS.yml \
  --fixtures examples/strict-oss/AGENTOWNERS.fixtures.yml
```

Examples are starting policies, not universal recommendations. Review the
default effect, sensitive-path globs, agent identity mapping, and required
reviewers before enabling enforcement in a production repository.
