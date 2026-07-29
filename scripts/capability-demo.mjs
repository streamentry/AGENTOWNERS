import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ACTION_TYPES = new Set(['tool', 'network', 'secret', 'data', 'privilege']);
const ZERO_HASH = '0'.repeat(64);

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function asObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function asStringList(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a string array`);
  }
  return value;
}

function validateManifest(raw) {
  const manifest = asObject(raw, 'manifest');
  if (manifest.version !== 1) throw new Error('manifest.version must be 1');
  const agent = asObject(manifest.agent, 'manifest.agent');
  for (const field of ['id', 'issuer', 'identity_sha256']) {
    if (typeof agent[field] !== 'string' || agent[field].length === 0) throw new Error(`manifest.agent.${field} is required`);
  }
  if (!/^[a-f0-9]{64}$/.test(agent.identity_sha256)) throw new Error('manifest.agent.identity_sha256 must be lowercase SHA-256');
  if (sha256(agent.id) !== agent.identity_sha256) throw new Error('manifest agent identity binding does not match agent.id');
  const repositories = asStringList(manifest.repositories, 'manifest.repositories');
  const tools = asObject(manifest.tools, 'manifest.tools');
  const network = asObject(manifest.network, 'manifest.network');
  const data = asObject(manifest.data, 'manifest.data');
  const privileges = asObject(manifest.privileges, 'manifest.privileges');
  const escalation = asObject(manifest.escalation, 'manifest.escalation');
  const budgets = asObject(manifest.budgets, 'manifest.budgets');
  const audit = asObject(manifest.audit, 'manifest.audit');
  const lists = {
    tools: asStringList(tools.allow, 'manifest.tools.allow'),
    destinations: asStringList(network.allowed_destinations, 'manifest.network.allowed_destinations'),
    secrets: asStringList(data.allowed_secret_scopes, 'manifest.data.allowed_secret_scopes'),
    data: asStringList(data.allowed_data_scopes, 'manifest.data.allowed_data_scopes'),
    privileges: asStringList(privileges.allow, 'manifest.privileges.allow'),
    approvals: asStringList(escalation.human_approval_required, 'manifest.escalation.human_approval_required')
  };
  if (typeof escalation.kill_on_violation !== 'boolean') throw new Error('manifest.escalation.kill_on_violation must be boolean');
  for (const field of ['max_actions', 'max_network_requests', 'max_secret_reads', 'max_privileged_actions']) {
    if (!Number.isInteger(budgets[field]) || budgets[field] < 0) throw new Error(`manifest.budgets.${field} must be a non-negative integer`);
  }
  if (audit.required !== true || audit.hash_chain !== true) throw new Error('manifest audit must require a hash chain');
  return { manifest, agent, repositories, ...lists, killOnViolation: escalation.kill_on_violation, budgets };
}

function normalizeAttempt(raw, index) {
  const attempt = asObject(raw, `attempt[${index}]`);
  if (typeof attempt.attempt_id !== 'string' || typeof attempt.agent_id !== 'string' || typeof attempt.issuer !== 'string' || typeof attempt.identity_sha256 !== 'string' || typeof attempt.type !== 'string') {
    throw new Error(`attempt[${index}] requires attempt_id, agent_id, issuer, identity_sha256, and type`);
  }
  if (!/^[a-f0-9]{64}$/.test(attempt.identity_sha256)) throw new Error(`attempt[${index}] identity_sha256 must be lowercase SHA-256`);
  if (!ACTION_TYPES.has(attempt.type)) throw new Error(`attempt[${index}] has unknown action type`);
  const target = attempt.type === 'tool' ? attempt.tool : attempt.type === 'network' ? attempt.destination : attempt.type === 'secret' ? attempt.scope : attempt.type === 'data' ? attempt.scope : attempt.capability;
  if (typeof target !== 'string' || target.length === 0) throw new Error(`attempt[${index}] target is required`);
  return {
    attempt_id: attempt.attempt_id,
    agent_id: attempt.agent_id,
    issuer: attempt.issuer,
    identity_sha256: attempt.identity_sha256,
    type: attempt.type,
    target,
    repository: typeof attempt.repository === 'string' ? attempt.repository : null,
    human_approved: attempt.human_approved === true,
    expected: attempt.expected
  };
}

export function evaluateCapabilities(rawManifest, rawAttempts) {
  const policy = validateManifest(rawManifest);
  if (!Array.isArray(rawAttempts)) throw new Error('attempts must be an array');
  let previousHash = ZERO_HASH;
  let actions = 0;
  let networkRequests = 0;
  let secretReads = 0;
  let privilegedActions = 0;
  let killTriggered = false;
  const audit = rawAttempts.map((rawAttempt, index) => {
    const attempt = normalizeAttempt(rawAttempt, index);
    let decision = 'allow';
    let reason = 'allowlisted';
    if (attempt.agent_id !== policy.agent.id || attempt.issuer !== policy.agent.issuer || attempt.identity_sha256 !== policy.agent.identity_sha256) {
      decision = 'deny'; reason = 'agent identity is not authorized';
    } else if (attempt.type === 'tool' && (!policy.tools.includes(attempt.target) || attempt.repository === null || !policy.repositories.includes(attempt.repository))) {
      decision = 'deny'; reason = 'tool or repository is not allowlisted';
    } else if (attempt.type === 'network' && !policy.destinations.includes(attempt.target)) {
      decision = 'deny'; reason = 'network destination is not allowlisted';
    } else if (attempt.type === 'secret' && !policy.secrets.includes(attempt.target)) {
      decision = 'deny'; reason = 'secret scope is not allowlisted';
    } else if (attempt.type === 'data' && !policy.data.includes(attempt.target)) {
      decision = 'deny'; reason = 'data scope is not allowlisted';
    } else if (attempt.type === 'privilege' && !policy.privileges.includes(attempt.target)) {
      decision = 'deny'; reason = 'privilege is not allowlisted';
    }
    const approvalType = attempt.type === 'privilege' ? ['write', 'merge', 'deploy'].find((kind) => attempt.target.startsWith(kind)) : undefined;
    if (decision === 'allow' && approvalType !== undefined && policy.approvals.includes(approvalType) && !attempt.human_approved) {
      decision = 'deny'; reason = 'human approval is required';
    }
    if (decision === 'allow' && actions >= policy.budgets.max_actions) {
      decision = 'deny'; reason = 'action budget exhausted';
    }
    if (decision === 'allow' && attempt.type === 'network' && networkRequests >= policy.budgets.max_network_requests) {
      decision = 'deny'; reason = 'network request budget exhausted';
    }
    if (decision === 'allow' && attempt.type === 'secret' && secretReads >= policy.budgets.max_secret_reads) {
      decision = 'deny'; reason = 'secret read budget exhausted';
    }
    if (decision === 'allow' && attempt.type === 'privilege' && privilegedActions >= policy.budgets.max_privileged_actions) {
      decision = 'deny'; reason = 'privileged action budget exhausted';
    }
    const event = {
      sequence: index + 1,
      attempt_id: attempt.attempt_id,
      agent_id: attempt.agent_id,
      issuer: attempt.issuer,
      identity_sha256: attempt.identity_sha256,
      type: attempt.type,
      target: attempt.target,
      repository: attempt.repository,
      decision,
      dispatched: decision === 'allow',
      reason,
      previous_hash: previousHash
    };
    const eventHash = sha256(stableStringify(event));
    previousHash = eventHash;
    if (decision === 'allow') {
      actions += 1;
      if (attempt.type === 'network') networkRequests += 1;
      if (attempt.type === 'secret') secretReads += 1;
      if (attempt.type === 'privilege') privilegedActions += 1;
    } else if (policy.killOnViolation) {
      killTriggered = true;
    }
    return { ...event, event_hash: eventHash };
  });
  return {
    schemaVersion: 1,
    status: 'complete',
    summary: { attempts: audit.length, allowed: audit.filter((event) => event.decision === 'allow').length, denied: audit.filter((event) => event.decision === 'deny').length, kill_triggered: killTriggered },
    audit,
    auditDigest: previousHash
  };
}

export async function runDemo(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const manifest = JSON.parse(await readFile(path.join(root, 'fixtures/capabilities/AGENT_CAPABILITIES.json'), 'utf8'));
  const attempts = JSON.parse(await readFile(path.join(root, 'fixtures/capabilities/attempts.json'), 'utf8'));
  const result = evaluateCapabilities(manifest, attempts);
  for (const [index, attempt] of attempts.entries()) {
    if (result.audit[index].decision !== attempt.expected) throw new Error(`fixture ${attempt.attempt_id} produced an unexpected decision`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDemo().then((result) => {
    if (process.argv.includes('--summary')) {
      console.log(
        `Capability demo: ${result.summary.allowed} allowed, ${result.summary.denied} denied, kill=${result.summary.kill_triggered}`,
      );
      return;
    }
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(`capability demo failed: ${error.message}`);
    process.exitCode = 1;
  });
}
