import { describe, expect, it } from 'vitest';
import {
  evaluateCapabilities,
  parseCapabilityAttempts,
  parseCapabilityManifest,
} from '../src/index.js';

const identitySha256 = 'e537d36bef65ee4bcad8e6cb280591d9c71e4af88a1dcdd7eab99812af8591c4';

const manifest = {
  version: 1,
  agent: {
    id: 'demo-coding-agent',
    issuer: 'demo.example.invalid',
    identity_sha256: identitySha256,
  },
  repositories: ['streamentry/AGENTOWNERS'],
  tools: { allow: ['git.read'] },
  network: { allowed_destinations: [] },
  data: { allowed_secret_scopes: [], allowed_data_scopes: ['repository'] },
  privileges: { allow: [] },
  escalation: { human_approval_required: ['write', 'merge', 'deploy'], kill_on_violation: true },
  budgets: {
    max_actions: 4,
    max_network_requests: 0,
    max_secret_reads: 0,
    max_privileged_actions: 0,
  },
  audit: { required: true, hash_chain: true },
} as const;

const attempts = [
  {
    attempt_id: 'read-policy',
    agent_id: 'demo-coding-agent',
    issuer: 'demo.example.invalid',
    identity_sha256: identitySha256,
    type: 'tool',
    tool: 'git.read',
    repository: 'streamentry/AGENTOWNERS',
  },
  {
    attempt_id: 'unlisted-egress',
    agent_id: 'demo-coding-agent',
    issuer: 'demo.example.invalid',
    identity_sha256: identitySha256,
    type: 'network',
    destination: 'https://example.invalid/egress',
  },
  {
    attempt_id: 'read-github-token',
    agent_id: 'demo-coding-agent',
    issuer: 'demo.example.invalid',
    identity_sha256: identitySha256,
    type: 'secret',
    scope: 'github.token',
  },
  {
    attempt_id: 'merge-pull-request',
    agent_id: 'demo-coding-agent',
    issuer: 'demo.example.invalid',
    identity_sha256: identitySha256,
    type: 'privilege',
    capability: 'merge_pr',
  },
] as const;

describe('capability contract', () => {
  it('validates the manifest identity binding and evaluates expected decisions', () => {
    expect(parseCapabilityManifest(manifest)).toEqual(manifest);
    const result = evaluateCapabilities(manifest, attempts);

    expect(result.audit.map((event) => event.decision)).toEqual([
      'allow',
      'deny',
      'deny',
      'deny',
    ]);
    expect(result.summary).toEqual({ attempts: 4, allowed: 1, denied: 3, kill_triggered: true });
    expect(result.audit[1]?.previous_hash).toBe(result.audit[0]?.event_hash);
  });

  it('is deterministic and does not include secret values', () => {
    const first = evaluateCapabilities(manifest, attempts);
    const second = evaluateCapabilities(manifest, attempts);

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toMatch(/secret-value|ghp_[a-z0-9]+|token=/i);
  });

  it('denies a request with a mismatched identity binding', () => {
    const result = evaluateCapabilities(manifest, [
      { ...attempts[0], identity_sha256: '0'.repeat(64) },
    ]);

    expect(result.audit[0]).toMatchObject({
      decision: 'deny',
      dispatched: false,
      reason: 'agent identity is not authorized',
    });
  });

  it('rejects unknown fields and missing action targets', () => {
    expect(() => parseCapabilityManifest({ ...manifest, unexpected: true })).toThrow();
    expect(() => parseCapabilityAttempts([{ ...attempts[0], tool: undefined }])).toThrow(
      'tool is required',
    );
  });
});
