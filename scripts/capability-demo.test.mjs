import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateCapabilities,
  stableStringify,
  verifyCapabilityAudit,
} from './capability-demo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  await readFile(path.join(root, 'fixtures/capabilities/AGENT_CAPABILITIES.json'), 'utf8'),
);
const attempts = JSON.parse(
  await readFile(path.join(root, 'fixtures/capabilities/attempts.json'), 'utf8'),
);

test('capability demo denies unlisted authority and is deterministic', () => {
  const first = evaluateCapabilities(manifest, attempts);
  const second = evaluateCapabilities(manifest, attempts);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.audit.map((event) => event.decision),
    ['allow', 'deny', 'deny', 'deny'],
  );
  assert.equal(first.audit[0].dispatched, true);
  assert.equal(
    first.audit.slice(1).every((event) => event.dispatched === false),
    true,
  );
  assert.equal(first.summary.kill_triggered, true);
  assert.equal(first.audit.length, 4);
  assert.equal(first.audit[1].previous_hash, first.audit[0].event_hash);
  assert.deepEqual(verifyCapabilityAudit(first), {
    valid: true,
    code: 'valid',
    eventsChecked: 4,
    auditDigest: first.auditDigest,
  });
  assert.equal(stableStringify(first), stableStringify(second));
  assert.doesNotMatch(JSON.stringify(first), /secret-value|ghp_[a-z0-9]+|token=/i);
});

test('capability demo fails closed for an identity mismatch', () => {
  const altered = [{ ...attempts[0], agent_id: 'untrusted-agent' }];
  const result = evaluateCapabilities(manifest, altered);
  assert.equal(result.audit[0].decision, 'deny');
  assert.equal(result.audit[0].dispatched, false);
});

test('capability demo denies a mismatched identity binding', () => {
  const altered = [{ ...attempts[0], identity_sha256: '0'.repeat(64) }];
  const result = evaluateCapabilities(manifest, altered);
  assert.equal(result.audit[0].decision, 'deny');
  assert.equal(result.audit[0].reason, 'agent identity is not authorized');
});

test('capability demo rejects malformed manifests', () => {
  assert.throws(
    () => evaluateCapabilities({ ...manifest, network: {} }, []),
    /allowed_destinations|Required/,
  );
});
