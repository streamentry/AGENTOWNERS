import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { detectAgent } from '@agent-owners/core';
import {
  getCommitEmails,
  getCommitMessages,
  getCommitNames,
  getCurrentActor,
} from '../src/git.js';
import { registerFingerprint } from '../src/commands/fingerprint.js';

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core');
  return { ...actual, detectAgent: vi.fn() };
});

vi.mock('../src/git.js', () => ({
  getCommitEmails: vi.fn(),
  getCommitMessages: vi.fn(),
  getCommitNames: vi.fn(),
  getCurrentActor: vi.fn(),
}));

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerFingerprint(program);
  return program;
}

describe('fingerprint terminal output', () => {
  let stdout = '';

  beforeEach(() => {
    stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    vi.mocked(getCommitMessages).mockReturnValue([]);
    vi.mocked(getCommitEmails).mockReturnValue([]);
    vi.mocked(getCommitNames).mockReturnValue([]);
    vi.mocked(getCurrentActor).mockReturnValue('actor');
  });

  afterEach(() => vi.restoreAllMocks());

  it('strips terminal controls and embedded newlines from untrusted fields', async () => {
    vi.mocked(detectAgent).mockReturnValue({
      confidence: 'likely',
      identityTrust: 'unverified',
      agentName: '\u001b]0;spoofed title\u0007Agent\nForged line',
      signals: ['\u001b[31munsafe\u001b[0m\nForged signal'],
    });

    await makeProgram().parseAsync(['node', 'agentowners', 'fingerprint']);

    expect(stdout).toContain('Agent: Agent Forged line');
    expect(stdout).toContain('    - unsafe Forged signal');
    expect(stdout).not.toContain('\u001b[31m');
    expect(stdout).not.toContain('\u001b]0;');
    expect(stdout).not.toContain('\nForged');
  });
});
