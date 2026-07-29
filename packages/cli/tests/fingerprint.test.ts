import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { detectAgent } from '@agent-owners/core';
import { getCommitMessages, getCurrentActor } from '../src/git.js';
import { registerFingerprint } from '../src/commands/fingerprint.js';

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core');
  return { ...actual, detectAgent: vi.fn() };
});

vi.mock('../src/git.js', () => ({
  getCommitMessages: vi.fn(),
  getCurrentActor: vi.fn(),
}));

function program(): Command {
  const command = new Command();
  command.exitOverride();
  registerFingerprint(command);
  return command;
}

describe('fingerprint command output boundary', () => {
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
    vi.mocked(getCommitMessages).mockReturnValue(['feat: document policy']);
    vi.mocked(getCurrentActor).mockReturnValue('coding-agent');
    vi.mocked(detectAgent).mockReturnValue({
      confidence: 'likely',
      signals: ['Commit message contains an AI agent marker'],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders the supported JSON output contract', async () => {
    await program().parseAsync([
      'node',
      'agentowners',
      'fingerprint',
      '--commit',
      'HEAD',
      '--output',
      'json',
    ]);

    expect(JSON.parse(stdout)).toEqual({
      confidence: 'likely',
      signals: ['Commit message contains an AI agent marker'],
    });
    expect(stderr).toBe('');
  });

  it('rejects unsupported output before reading Git evidence', async () => {
    await program().parseAsync(['node', 'agentowners', 'fingerprint', '--output', 'yaml']);

    expect(process.exit).toHaveBeenCalledWith(64);
    expect(stderr).toBe('Output format must be one of: text, json.\n');
    expect(getCommitMessages).not.toHaveBeenCalled();
    expect(detectAgent).not.toHaveBeenCalled();
    expect(stdout).toBe('');
  });
});
