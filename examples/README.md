# Policy examples

Each directory contains a complete `AGENTOWNERS.yml` and an executable
`AGENTOWNERS.fixtures.yml` contract. Copy the policy into a repository, adapt
it, and keep the fixture suite beside it so future changes cannot silently
alter the documented decision boundary.

| Example | Default posture | Best starting point |
| --- | --- | --- |
| [`minimal`](minimal/AGENTOWNERS.yml) | Docs may proceed; dependencies require approval; workflows and secrets block | A new repository learning the contract |
| [`strict-oss`](strict-oss/AGENTOWNERS.yml) | Docs and dependencies require approval; sensitive paths block | Most open-source projects |
| [`security-sensitive`](security-sensitive/AGENTOWNERS.yml) | Unknown agents, workflows, auth, and permission paths block | Security-critical repositories |
| [`monorepo`](monorepo/AGENTOWNERS.yml) | Package-scoped review plus repository-wide sensitive-path defaults | Multi-package repositories |
| [`dependency-bots`](dependency-bots/AGENTOWNERS.yml) | Dependabot and Renovate are identified explicitly; privileged actions block | Automated dependency PRs |

Every profile is exercised by the public fixture runner. Fixtures are examples
of the policy contract, not a substitute for reviewing defaults and sensitive
paths before enabling enforcement.

## Copy and validate

```bash
mkdir -p .github
cp examples/strict-oss/AGENTOWNERS.yml .github/AGENTOWNERS.yml
agentowners validate .github/AGENTOWNERS.yml
```

Run any example through the same public contract used in CI:

```bash
agentowners test \
  --policy examples/security-sensitive/AGENTOWNERS.yml \
  --fixtures examples/security-sensitive/AGENTOWNERS.fixtures.yml
```

The fixture runner asserts exact decisions for representative documentation,
workflow, dependency, identity, test, authentication, and secret boundaries.
