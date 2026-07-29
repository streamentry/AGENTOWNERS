import { describe, expect, it } from 'vitest';
import {
  evaluateCapabilities,
  hashCapabilityManifest,
  parseCapabilityAttempts,
  parseCapabilityManifest,
  verifyCapabilityAudit,
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

    expect(result.audit.map((event) => event.decision)).toEqual(['allow', 'deny', 'deny', 'deny']);
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

  it('verifies the complete audit chain and summary contract', () => {
    const result = evaluateCapabilities(manifest, attempts);

    expect(verifyCapabilityAudit(result)).toEqual({
      valid: true,
      code: 'valid',
      eventsChecked: 4,
      manifestDigest: hashCapabilityManifest(manifest),
      auditDigest: result.auditDigest,
    });
    expect(verifyCapabilityAudit(result, hashCapabilityManifest(manifest)).valid).toBe(true);
    expect(verifyCapabilityAudit(result, '0'.repeat(64))).toMatchObject({
      valid: false,
      code: 'manifest_mismatch',
    });
  });

  it('identifies tampering without echoing untrusted event content', () => {
    const result = evaluateCapabilities(manifest, attempts);

    expect(
      verifyCapabilityAudit({
        ...result,
        audit: result.audit.map((event, index) =>
          index === 1 ? { ...event, reason: 'secret-value-should-not-be-printed' } : event,
        ),
      }),
    ).toMatchObject({ valid: false, code: 'invalid_hash', eventsChecked: 1 });
    expect(
      JSON.stringify(
        verifyCapabilityAudit({ ...result, summary: { ...result.summary, allowed: 4 } }),
      ),
    ).not.toContain('secret-value');
  });

  it('distinguishes sequence, digest, summary, and shape failures', () => {
    const result = evaluateCapabilities(manifest, attempts);

    expect(
      verifyCapabilityAudit({
        ...result,
        audit: result.audit.map((event, index) =>
          index === 2 ? { ...event, sequence: 99 } : event,
        ),
      }),
    ).toMatchObject({ valid: false, code: 'invalid_sequence' });
    expect(verifyCapabilityAudit({ ...result, auditDigest: '0'.repeat(64) })).toMatchObject({
      valid: false,
      code: 'invalid_digest',
    });
    expect(
      verifyCapabilityAudit({ ...result, summary: { ...result.summary, denied: 0 } }),
    ).toMatchObject({ valid: false, code: 'invalid_summary' });
    expect(
      verifyCapabilityAudit({
        ...result,
        summary: { ...result.summary, kill_triggered: false },
      }),
    ).toMatchObject({ valid: false, code: 'invalid_digest' });
    expect(verifyCapabilityAudit({ schemaVersion: 1 })).toEqual({
      valid: false,
      code: 'invalid_shape',
      eventsChecked: 0,
      manifestDigest: null,
      auditDigest: null,
    });
  });
});
