import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parsePolicy } from './schema.js';
import type { AgentOwnersPolicy, PolicyDiff, PolicyDiffChange } from './types.js';

const digestPattern = /^[a-f0-9]{64}$/;

export const policyDiffSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseDigest: z.string().regex(digestPattern),
    proposedDigest: z.string().regex(digestPattern),
    identical: z.boolean(),
    changes: z
      .array(
        z
          .object({
            path: z.string().min(1),
            kind: z.enum(['added', 'removed', 'changed']),
          })
          .strict(),
      )
      .readonly(),
  })
  .strict();

function stablePolicyStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError('policy contains an unsupported value');
    return serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map(stablePolicyStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stablePolicyStringify(record[key])}`)
    .join(',')}}`;
}

export function hashPolicy(policy: AgentOwnersPolicy): string {
  return createHash('sha256').update(stablePolicyStringify(policy)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function childPath(parent: string, segment: string | number): string {
  return `${parent}/${escapeJsonPointerSegment(String(segment))}`;
}

function recordChange(
  changes: PolicyDiffChange[],
  path: string,
  kind: PolicyDiffChange['kind'],
): void {
  changes.push({ path: path || '/', kind });
}

function compareValues(
  base: unknown,
  proposed: unknown,
  path: string,
  changes: PolicyDiffChange[],
): void {
  if (Array.isArray(base) && Array.isArray(proposed)) {
    const length = Math.max(base.length, proposed.length);
    for (let index = 0; index < length; index += 1) {
      const child = childPath(path, index);
      if (index >= base.length) recordChange(changes, child, 'added');
      else if (index >= proposed.length) recordChange(changes, child, 'removed');
      else compareValues(base[index], proposed[index], child, changes);
    }
    return;
  }

  if (isRecord(base) && isRecord(proposed)) {
    // Keep structural changes aligned with stablePolicyStringify(): optional
    // fields explicitly set to undefined are absent from the canonical form.
    const keys = new Set([
      ...Object.keys(base).filter((key) => base[key] !== undefined),
      ...Object.keys(proposed).filter((key) => proposed[key] !== undefined),
    ]);
    for (const key of [...keys].sort()) {
      const child = childPath(path, key);
      if (!(key in base)) recordChange(changes, child, 'added');
      else if (!(key in proposed)) recordChange(changes, child, 'removed');
      else compareValues(base[key], proposed[key], child, changes);
    }
    return;
  }

  if (stablePolicyStringify(base) !== stablePolicyStringify(proposed)) {
    recordChange(changes, path, 'changed');
  }
}

export function diffPolicies(baseInput: unknown, proposedInput: unknown): PolicyDiff {
  const base = parsePolicy(baseInput);
  const proposed = parsePolicy(proposedInput);
  const baseDigest = hashPolicy(base);
  const proposedDigest = hashPolicy(proposed);
  const changes: PolicyDiffChange[] = [];
  compareValues(base, proposed, '', changes);
  changes.sort((left, right) => {
    if (left.path !== right.path) return left.path < right.path ? -1 : 1;
    if (left.kind === right.kind) return 0;
    return left.kind < right.kind ? -1 : 1;
  });

  return {
    schemaVersion: 1,
    baseDigest,
    proposedDigest,
    identical: changes.length === 0,
    changes,
  };
}
