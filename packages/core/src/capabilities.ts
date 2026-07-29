import { createHash } from 'node:crypto';
import { z } from 'zod';
import type {
  CapabilityAttempt,
  CapabilityAuditEvent,
  CapabilityDecision,
  CapabilityEvaluationResult,
  CapabilityManifest,
} from './types.js';

const capabilityActionTypes = ['tool', 'network', 'secret', 'data', 'privilege'] as const;
const identityHashPattern = /^[a-f0-9]{64}$/;
const zeroHash = '0'.repeat(64);

const identitySchema = z
  .object({
    id: z.string().min(1),
    issuer: z.string().min(1),
    identity_sha256: z.string().regex(identityHashPattern),
  })
  .strict();

const stringList = z.array(z.string().min(1));

export const capabilityManifestSchema = z
  .object({
    version: z.literal(1),
    agent: identitySchema,
    repositories: stringList,
    tools: z.object({ allow: stringList }).strict(),
    network: z.object({ allowed_destinations: stringList }).strict(),
    data: z
      .object({
        allowed_secret_scopes: stringList,
        allowed_data_scopes: stringList,
      })
      .strict(),
    privileges: z.object({ allow: stringList }).strict(),
    escalation: z
      .object({
        human_approval_required: stringList,
        kill_on_violation: z.boolean(),
      })
      .strict(),
    budgets: z
      .object({
        max_actions: z.number().int().nonnegative(),
        max_network_requests: z.number().int().nonnegative(),
        max_secret_reads: z.number().int().nonnegative(),
        max_privileged_actions: z.number().int().nonnegative(),
      })
      .strict(),
    audit: z.object({ required: z.literal(true), hash_chain: z.literal(true) }).strict(),
  })
  .strict();

const capabilityAttemptBaseSchema = z
  .object({
    attempt_id: z.string().min(1),
    agent_id: z.string().min(1),
    issuer: z.string().min(1),
    identity_sha256: z.string().regex(identityHashPattern),
    type: z.enum(capabilityActionTypes),
    tool: z.string().min(1).optional(),
    destination: z.string().min(1).optional(),
    scope: z.string().min(1).optional(),
    capability: z.string().min(1).optional(),
    repository: z.string().min(1).optional(),
    human_approved: z.boolean().optional(),
    expected: z.enum(['allow', 'deny']).optional(),
  })
  .strict();

export const capabilityAttemptSchema = capabilityAttemptBaseSchema.superRefine((attempt, context) => {
  const field = {
    tool: 'tool',
    network: 'destination',
    secret: 'scope',
    data: 'scope',
    privilege: 'capability',
  }[attempt.type] as keyof typeof attempt;
  if (typeof attempt[field] !== 'string' || attempt[field].length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: `${field} is required for ${attempt.type} attempts`,
    });
  }
});

export function stableCapabilityStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCapabilityStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableCapabilityStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

export function hashCapabilityIdentity(agentId: string): string {
  return createHash('sha256').update(agentId).digest('hex');
}

export function parseCapabilityManifest(input: unknown): CapabilityManifest {
  const manifest = capabilityManifestSchema.parse(input);
  if (hashCapabilityIdentity(manifest.agent.id) !== manifest.agent.identity_sha256) {
    throw new Error('manifest agent identity binding does not match agent.id');
  }
  return manifest;
}

export function parseCapabilityAttempts(input: unknown): CapabilityAttempt[] {
  return z.array(capabilityAttemptSchema).parse(input);
}

function targetForAttempt(attempt: CapabilityAttempt): string {
  const target =
    attempt.type === 'tool'
      ? attempt.tool
      : attempt.type === 'network'
        ? attempt.destination
        : attempt.type === 'secret' || attempt.type === 'data'
          ? attempt.scope
          : attempt.capability;
  if (target === undefined) throw new Error(`attempt ${attempt.attempt_id} has no normalized target`);
  return target;
}

function requiredApproval(attempt: CapabilityAttempt): string | undefined {
  if (attempt.type !== 'privilege') return undefined;
  return ['write', 'merge', 'deploy'].find((kind) => targetForAttempt(attempt).startsWith(kind));
}

function isAllowlisted(attempt: CapabilityAttempt, manifest: CapabilityManifest): boolean {
  const target = targetForAttempt(attempt);
  if (attempt.type === 'tool') {
    return (
      manifest.tools.allow.includes(target) &&
      attempt.repository !== undefined &&
      manifest.repositories.includes(attempt.repository)
    );
  }
  if (attempt.type === 'network') return manifest.network.allowed_destinations.includes(target);
  if (attempt.type === 'secret') return manifest.data.allowed_secret_scopes.includes(target);
  if (attempt.type === 'data') return manifest.data.allowed_data_scopes.includes(target);
  return manifest.privileges.allow.includes(target);
}

function denyReason(
  attempt: CapabilityAttempt,
  manifest: CapabilityManifest,
  counts: { actions: number; network: number; secrets: number; privileged: number },
): string | null {
  if (
    attempt.agent_id !== manifest.agent.id ||
    attempt.issuer !== manifest.agent.issuer ||
    attempt.identity_sha256 !== manifest.agent.identity_sha256
  ) {
    return 'agent identity is not authorized';
  }
  if (!isAllowlisted(attempt, manifest)) {
    return attempt.type === 'tool'
      ? 'tool or repository is not allowlisted'
      : `${attempt.type} is not allowlisted`;
  }
  const approval = requiredApproval(attempt);
  if (
    approval !== undefined &&
    manifest.escalation.human_approval_required.includes(approval) &&
    attempt.human_approved !== true
  ) {
    return 'human approval is required';
  }
  if (counts.actions >= manifest.budgets.max_actions) return 'action budget exhausted';
  if (attempt.type === 'network' && counts.network >= manifest.budgets.max_network_requests) {
    return 'network request budget exhausted';
  }
  if (attempt.type === 'secret' && counts.secrets >= manifest.budgets.max_secret_reads) {
    return 'secret read budget exhausted';
  }
  if (attempt.type === 'privilege' && counts.privileged >= manifest.budgets.max_privileged_actions) {
    return 'privileged action budget exhausted';
  }
  return null;
}

export function evaluateCapabilities(
  manifestInput: unknown,
  attemptsInput: unknown,
): CapabilityEvaluationResult {
  const manifest = parseCapabilityManifest(manifestInput);
  const attempts = parseCapabilityAttempts(attemptsInput);
  let previousHash = zeroHash;
  const counts = { actions: 0, network: 0, secrets: 0, privileged: 0 };
  let killTriggered = false;
  const audit = attempts.map((attempt, index): CapabilityAuditEvent => {
    const reason = denyReason(attempt, manifest, counts);
    const decision: CapabilityDecision = reason === null ? 'allow' : 'deny';
    const eventWithoutHash = {
      sequence: index + 1,
      attempt_id: attempt.attempt_id,
      agent_id: attempt.agent_id,
      issuer: attempt.issuer,
      identity_sha256: attempt.identity_sha256,
      type: attempt.type,
      target: targetForAttempt(attempt),
      repository: attempt.repository ?? null,
      decision,
      dispatched: decision === 'allow',
      reason: reason ?? 'allowlisted',
      previous_hash: previousHash,
    };
    const eventHash = createHash('sha256')
      .update(stableCapabilityStringify(eventWithoutHash))
      .digest('hex');
    previousHash = eventHash;
    if (decision === 'allow') {
      counts.actions += 1;
      if (attempt.type === 'network') counts.network += 1;
      if (attempt.type === 'secret') counts.secrets += 1;
      if (attempt.type === 'privilege') counts.privileged += 1;
    } else if (manifest.escalation.kill_on_violation) {
      killTriggered = true;
    }
    return { ...eventWithoutHash, event_hash: eventHash };
  });
  return {
    schemaVersion: 1,
    status: 'complete',
    summary: {
      attempts: audit.length,
      allowed: audit.filter((event) => event.decision === 'allow').length,
      denied: audit.filter((event) => event.decision === 'deny').length,
      kill_triggered: killTriggered,
    },
    audit,
    auditDigest: previousHash,
  };
}
