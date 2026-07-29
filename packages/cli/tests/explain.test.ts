import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { createHash } from 'node:crypto';
import { registerExplain } from '../src/commands/explain.js';

const { mockReadFileSync } = vi.hoisted(() => ({ mockReadFileSync: vi.fn() }));
vi.mock('fs', () => ({ readFileSync: mockReadFileSync }));

function program(): Command {
  const command = new Command();
  command.exitOverride();
  registerExplain(command);
  return command;
}

describe('explain command', () => {
  let stdout = '';
  let stderr = '';

  beforeEach(() => {
    vi.clearAllMocks();
    stdout = '';
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('explains a raw CLI Decision JSON file', async () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        effect: 'require_approval',
        matchedRules: [{ name: 'auth', effect: 'require_approval', reason: 'Review auth.' }],
        detectedActions: ['modify_auth'],
        riskScore: 65,
        riskLevel: 'high',
        requiredReviewers: ['@security'],
        labelsToApply: ['risk-high'],
        explanation: 'Human review is required.',
      }),
    );

    await program().parseAsync(['node', 'agentowners', 'explain', '--decision', 'decision.json']);

    expect(stdout).toContain('Decision: \x1b[1mREQUIRE_APPROVAL\x1b[0m');
    expect(stdout).toContain('Review auth.');
    expect(stdout).toContain('Required reviewers: @security');
    expect(stderr).toBe('');
  });

  it('explains an Action audit artifact with provenance context', async () => {
    const auditJson = JSON.stringify({
      version: 1,
      timestamp: '2026-07-29T00:00:00.000Z',
      repository: 'streamentry/AGENTOWNERS',
      event: 'pull_request',
      actor: 'github-copilot[bot]',
      matchedAgent: 'github-copilot',
      confidence: 'confirmed',
      decision: 'block',
      riskScore: 95,
      riskLevel: 'critical',
      detectedActions: ['edit_workflows'],
      changedFiles: ['.github/workflows/release.yml'],
      matchedRules: [{ name: 'workflows', effect: 'block', reason: 'No workflow edits.' }],
      requiredReviewers: [],
      labelsToApply: ['risk-critical'],
    });
    mockReadFileSync.mockReturnValue(auditJson);

    await program().parseAsync(['node', 'agentowners', 'explain']);

    expect(stdout).toContain('Audit timestamp: 2026-07-29T00:00:00.000Z');
    expect(stdout).toContain('Repository: streamentry/AGENTOWNERS');
    expect(stdout).toContain('Changed files: 1');
    expect(stdout).toContain('Decision: \x1b[1mBLOCK\x1b[0m');
    expect(stdout).toContain('No workflow edits.');
    expect(stdout).toContain('Labels to apply: risk-critical');
  });

  it('verifies an audit artifact SHA-256 digest before explaining it', async () => {
    const auditJson = JSON.stringify({
      version: 1,
      timestamp: '2026-07-29T00:00:00.000Z',
      actor: 'github-copilot[bot]',
      confidence: 'confirmed',
      decision: 'allow',
      riskScore: 5,
      riskLevel: 'low',
      detectedActions: [],
      changedFiles: [],
      matchedRules: [],
      requiredReviewers: [],
      labelsToApply: [],
    });
    mockReadFileSync.mockReturnValue(auditJson);
    const digest = createHash('sha256').update(auditJson, 'utf8').digest('hex');

    await program().parseAsync(['node', 'agentowners', 'explain', '--sha256', digest]);

    expect(stdout).toContain('Decision: \x1b[1mALLOW\x1b[0m');
    expect(stderr).toBe('');
  });

  it('rejects an audit artifact when its SHA-256 digest does not match', async () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        version: 1,
        timestamp: '2026-07-29T00:00:00.000Z',
        actor: 'github-copilot[bot]',
        confidence: 'confirmed',
        decision: 'allow',
        riskScore: 5,
        riskLevel: 'low',
        detectedActions: [],
        changedFiles: [],
        matchedRules: [],
        requiredReviewers: [],
      }),
    );

    await program().parseAsync(['node', 'agentowners', 'explain', '--sha256', '0'.repeat(64)]);

    expect(process.exit).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('does not match the supplied SHA-256 digest');
    expect(stdout).toBe('');
  });

  it('accepts legacy v1 audit artifacts without labels', async () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        version: 1,
        timestamp: '2026-07-29T00:00:00.000Z',
        actor: 'github-copilot[bot]',
        confidence: 'confirmed',
        decision: 'allow',
        riskScore: 5,
        riskLevel: 'low',
        detectedActions: [],
        changedFiles: [],
        matchedRules: [],
        requiredReviewers: [],
      }),
    );

    await program().parseAsync(['node', 'agentowners', 'explain']);

    expect(stdout).toContain('Decision: \x1b[1mALLOW\x1b[0m');
    expect(stderr).toBe('');
  });

  it('rejects malformed or unrecognized decision JSON with a bounded error', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ effect: 'allow' }));

    await program().parseAsync(['node', 'agentowners', 'explain']);

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(stderr).toContain('is not valid Decision or audit JSON');
    expect(stdout).toBe('');
  });
});
