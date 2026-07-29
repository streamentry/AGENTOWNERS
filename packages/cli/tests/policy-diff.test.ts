import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { loadPolicyFile } from '@agent-owners/core';
import { registerPolicyDiff, runPolicyDiff } from '../src/commands/policy-diff.js';

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core');
  return { ...actual, loadPolicyFile: vi.fn() };
});

const basePolicy = {
  version: 1 as const,
  defaults: { unknown_agent: 'require_approval' as const },
};

describe('policy-diff command', () => {
  let stdout = '';
  let stderr = '';

  beforeEach(() => {
    process.exitCode = undefined;
    stdout = '';
    stderr = '';
    vi.mocked(loadPolicyFile).mockReset();
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('registers a value-free policy diff command', () => {
    const program = new Command();
    registerPolicyDiff(program);
    const command = program.commands.find((candidate) => candidate.name() === 'policy-diff');
    expect(command?.options.map((option) => option.flags)).toEqual(
      expect.arrayContaining([
        '--base <path>',
        '--proposed <path>',
        '--format <format>',
        '--fail-on-change',
      ]),
    );
  });

  it('emits a stable JSON result and fails only when requested', async () => {
    vi.mocked(loadPolicyFile)
      .mockResolvedValueOnce(basePolicy)
      .mockResolvedValueOnce({ ...basePolicy, defaults: { unknown_agent: 'block' as const } });

    await runPolicyDiff({ base: 'base.yml', proposed: 'proposed.yml', format: 'json' });

    const output = JSON.parse(stdout) as {
      status: string;
      diff: { identical: boolean; changes: Array<{ path: string; kind: string }> };
    };
    expect(output.status).toBe('complete');
    expect(output.diff).toMatchObject({
      identical: false,
      changes: [{ path: '/defaults/unknown_agent', kind: 'changed' }],
    });
    expect(stdout).not.toContain('require_approval');
    expect(stdout).not.toContain('block');
    expect(stdout).not.toContain('base.yml');
    expect(stdout).not.toContain('proposed.yml');
    expect(process.exitCode).toBe(0);
  });

  it('returns exit one for changes when fail-on-change is set', async () => {
    vi.mocked(loadPolicyFile)
      .mockResolvedValueOnce(basePolicy)
      .mockResolvedValueOnce({ version: 1 as const });

    await runPolicyDiff({
      base: 'base.yml',
      proposed: 'proposed.yml',
      format: 'text',
      failOnChange: true,
    });

    expect(stdout).toContain('1 change(s)');
    expect(stdout).not.toContain('require_approval');
    expect(stdout).not.toContain('block');
    expect(process.exitCode).toBe(1);
  });

  it('fails closed with a generic error for invalid policies', async () => {
    vi.mocked(loadPolicyFile).mockRejectedValue(new Error('secret policy content'));

    await runPolicyDiff({ base: 'base.yml', proposed: 'proposed.yml', format: 'json' });

    expect(JSON.parse(stderr)).toMatchObject({
      status: 'error',
      error: { code: 'INVALID_POLICY' },
    });
    expect(stderr).not.toContain('secret policy content');
    expect(process.exitCode).toBe(65);
  });

  it('rejects an unsupported output format before reading either file', async () => {
    await runPolicyDiff({ base: 'base.yml', proposed: 'proposed.yml', format: 'yaml' });

    expect(stderr).toContain('Invalid policy diff command input.');
    expect(vi.mocked(loadPolicyFile)).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(64);
  });
});
