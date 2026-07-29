import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { diffPolicies, hashPolicy, policyDiffSchema } from '../src/policy-diff.js';

const basePolicy = {
  version: 1 as const,
  defaults: { unknown_agent: 'require_approval' as const, docs_only: 'allow' as const },
  rules: [
    {
      name: 'Block workflows',
      when: { changes_workflows: true },
      effect: 'block' as const,
      reason: 'Workflow changes require review.',
    },
  ],
};

describe('diffPolicies', () => {
  it('is deterministic and ignores object key order', () => {
    const reordered = {
      rules: basePolicy.rules,
      defaults: basePolicy.defaults,
      version: 1 as const,
    };

    expect(diffPolicies(basePolicy, reordered)).toEqual({
      schemaVersion: 1,
      baseDigest: hashPolicy(basePolicy),
      proposedDigest: hashPolicy(basePolicy),
      identical: true,
      changes: [],
    });
  });

  it('treats explicitly undefined optional fields as absent', () => {
    const withUndefined = { version: 1 as const, defaults: undefined };

    expect(diffPolicies({ version: 1 as const }, withUndefined)).toEqual({
      schemaVersion: 1,
      baseDigest: hashPolicy({ version: 1 as const }),
      proposedDigest: hashPolicy({ version: 1 as const }),
      identical: true,
      changes: [],
    });
  });

  it('reports paths and change kinds without exposing policy values', () => {
    const proposed = {
      ...basePolicy,
      defaults: { ...basePolicy.defaults, unknown_agent: 'block' as const },
      rules: [
        { ...basePolicy.rules[0], effect: 'require_approval' as const },
        {
          name: 'Protect auth',
          when: { changes_auth: true },
          effect: 'block' as const,
          reason: 'Auth changes require review.',
        },
      ],
    };

    const diff = diffPolicies(basePolicy, proposed);

    expect(diff.identical).toBe(false);
    expect(diff.changes).toEqual([
      { path: '/defaults/unknown_agent', kind: 'changed' },
      { path: '/rules/0/effect', kind: 'changed' },
      { path: '/rules/1', kind: 'added' },
    ]);
    expect(JSON.stringify(diff)).not.toContain('block');
    expect(policyDiffSchema.parse(diff)).toEqual(diff);
  });

  it('escapes JSON Pointer path segments', () => {
    const proposed = {
      ...basePolicy,
      agents: {
        existing: { match: { actors: ['existing'] } },
        'bot/name~one': { match: { actors: ['bot'] } },
      },
    };
    const base = {
      ...basePolicy,
      agents: { existing: { match: { actors: ['existing'] } } },
    };

    expect(diffPolicies(base, proposed).changes).toEqual([
      { path: '/agents/bot~1name~0one', kind: 'added' },
    ]);
  });

  it('rejects invalid policy input before producing a diff', () => {
    expect(() => diffPolicies(basePolicy, { version: 1, unexpected: 'value' })).toThrow(ZodError);
  });
});
