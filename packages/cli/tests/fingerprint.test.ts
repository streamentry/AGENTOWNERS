import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { detectAgent } from '@agent-owners/core';
import { getCommitMessage, getCurrentActor } from '../src/git.js';
import { registerFingerprint } from '../src/commands/fingerprint.js';

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core');
  return { ...actual, detectAgent: vi.fn() };
});

vi.mock('../src/git.js', () => ({
  getCommitMessage: vi.fn(),
  getCurrentActor: vi.fn(),
}));

function program(): Command {
  const command = new Command();
  command.exitOverride();
  registerFingerprint(command);
  return command;
}

describe('fingerprint command input boundaries', () => {
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
    vi.mocked(getCurrentActor).mockReturnValue(null);
    vi.mocked(detectAgent).mockReturnValue({ confidence: 'unknown', signals: [] });
  });

  afterEach(() => vi.restoreAllMocks());

  it('fails when the requested commit evidence is unavailable', async () => {
    vi.mocked(getCommitMessage).mockImplementation(() => {
      throw new Error('sensitive Git detail');
    });

    await program().parseAsync(['node', 'agentowners', 'fingerprint', '--commit', 'missing']);

    expect(process.exit).toHaveBeenCalledWith(2);
    expect(stderr).toBe('Error reading requested commit. Verify the ref and repository.\n');
    expect(stderr).not.toContain('sensitive Git detail');
    expect(getCurrentActor).not.toHaveBeenCalled();
    expect(detectAgent).not.toHaveBeenCalled();
    expect(stdout).toBe('');
  });

  it('passes direct commit evidence into detection and renders JSON', async () => {
    vi.mocked(getCommitMessage).mockReturnValue(['Co-Authored-By: Claude']);
    vi.mocked(getCurrentActor).mockReturnValue('coding-agent');
    vi.mocked(detectAgent).mockReturnValue({
      confidence: 'likely',
      signals: ['Commit message contains AI agent marker: Claude'],
    });

    await program().parseAsync([
      'node',
      'agentowners',
      'fingerprint',
      '--commit',
      'ROOT',
      '--output',
      'json',
    ]);

    expect(getCommitMessage).toHaveBeenCalledWith('ROOT', process.cwd());
    expect(detectAgent).toHaveBeenCalledWith({
      actor: 'coding-agent',
      commitMessages: ['Co-Authored-By: Claude'],
    });
    expect(JSON.parse(stdout)).toMatchObject({ confidence: 'likely' });
    expect(stderr).toBe('');
  });
});
