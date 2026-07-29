# @agent-owners/core

Deterministic policy evaluation for AI-agent contributions.

This is the pure engine behind
[AGENTOWNERS](https://github.com/streamentry/AGENTOWNERS). It validates
`AGENTOWNERS.yml`, detects agent signals, classifies changed files, infers
actions, resolves policy rules, scores risk, and renders auditable decisions.

## Install

```bash
npm install @agent-owners/core
```

The package exports its generated authoring schema as
`@agent-owners/core/schema.json`. The checked-in
[schema artifact](./agentowners.schema.json) is generated from the runtime Zod
validator and verified for drift in CI.

Portable policy suites use `parsePolicyFixtureSuite()` and
`runPolicyFixtureSuite()`. They exercise detection, classification, inference,
and evaluation without Git, GitHub, network access, or hidden state.

The experimental capability API provides the same deterministic boundary for a
pre-dispatch adapter. `parseCapabilityManifest()` validates strict identity,
scope, privilege, budget, escalation, and audit fields; `evaluateCapabilities()`
returns a hash-chained audit without performing dispatch or I/O.

```ts
import { evaluateCapabilities, verifyCapabilityAudit } from '@agent-owners/core';

const result = evaluateCapabilities(manifestJson, attemptsJson);
const verification = verifyCapabilityAudit(result);
// verification.valid proves the event chain and summary match the digest.
```

`verifyCapabilityAudit()` accepts an untrusted saved result and returns only a
stable status code, event count, and digest. The digest covers the event-chain
head and summary, so a downstream adapter can reject tampered logs without
exposing scopes or targets.

## Contract

- Same input produces the same decision.
- `block > require_approval > allow`.
- Unknown agents require approval by default.
- Workflow and secret-file changes block by default.
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

Read the [policy specification](https://github.com/streamentry/AGENTOWNERS/blob/main/docs/specs/readme.md)
and [security policy](https://github.com/streamentry/AGENTOWNERS/security/policy)
before enforcing decisions in a sensitive repository.
