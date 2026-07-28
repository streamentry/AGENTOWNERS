# @agent-owners/core

Deterministic policy evaluation for AI-agent contributions.

> **Pre-release:** this package is not published yet. The install command and
> API below describe the intended `0.1.0` contract. Evaluate the current source
> from the [AGENTOWNERS repository](https://github.com/streamentry/AGENTOWNERS);
> do not depend on an unpublished registry artifact.

This is the pure engine behind
[AGENTOWNERS](https://github.com/streamentry/AGENTOWNERS). It validates
`AGENTOWNERS.yml`, detects agent signals, classifies changed files, infers
actions, resolves policy rules, scores risk, and renders auditable decisions.

Use this package when embedding the deterministic engine in another tool. Use
[`@agent-owners/cli`](https://github.com/streamentry/AGENTOWNERS/tree/main/packages/cli)
for local Git checks, or the repository Action for GitHub enforcement.

## Install

Available after the first public release:

```bash
npm install @agent-owners/core
```

The package exports its generated authoring schema as
`@agent-owners/core/schema.json`. The checked-in
[schema artifact](./agentowners.schema.json) is generated from the runtime Zod
validator and verified for drift in CI.

Portable policy suites use `parsePolicyFixtureSuite()` and
`runPolicyFixtureSuite()`. They exercise detection, classification, inference,
diff-content secret scanning, and evaluation without Git, GitHub, network
access, or hidden state.

For a concise event adapter, use `evaluatePolicyFromEvent()`; it performs file
classification and action inference before evaluating the policy:

```ts
import { evaluatePolicyFromEvent, parsePolicy } from '@agent-owners/core';

const decision = evaluatePolicyFromEvent({
  policy: parsePolicy({ version: 1 }),
  changedFiles: ['package.json'],
  event: { eventType: 'pull_request.opened', actor: 'unknown-user' },
});
```

## Contract

- Same input produces the same decision.
- `block > require_approval > allow`.
- Unknown agents require approval by default.
- Workflow and secret-file changes block by default.
- Detection confidence is separate from identity trust. Only `verified` actor
  identity may use an agent-specific allowlist or `known_agent` default;
  commit metadata, labels, titles, and bodies are `unverified` evidence.
- File-based actions use the same canonical classifier whether callers provide
  a classification or let the engine derive one from changed paths. Diff
  content can add `touch_secrets`, but matched secret values are never exposed.
- Unverified labels, titles, and bodies cannot satisfy an `allow` rule for
  sensitive actions unless the same rule also names a trusted actor or verified
  agent.
- Unknown policy fields fail validation.
- No model, network, shell, database, clock, or persistent state.

```ts
import {
  classifyFiles,
  detectAgent,
  evaluatePolicy,
  inferActions,
  parsePolicy,
  renderSarif,
} from '@agent-owners/core';

const policy = parsePolicy({
  version: 1,
  defaults: {
    unknown_agent: 'require_approval',
    workflows: 'block',
    secrets: 'block',
  },
});

const changedFiles = ['docs/guide.md'];
const filesClassification = classifyFiles(changedFiles);
const agentDetection = detectAgent({
  actor: 'github-copilot[bot]',
  policy,
});
const detectedActions = inferActions({
  eventType: 'pull_request.opened',
  changedFiles,
  filesClassification,
});

const decision = evaluatePolicy({
  policy,
  agentDetection,
  detectedActions,
  changedFiles,
  filesClassification,
  actor: 'github-copilot[bot]',
});

const sarif = renderSarif(decision);
```

Read the [policy reference](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/policy-reference.md),
[policy specification](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/specs/readme.md),
and [security policy](https://github.com/streamentry/AGENTOWNERS/security/policy)
before enforcing decisions in a sensitive repository.
