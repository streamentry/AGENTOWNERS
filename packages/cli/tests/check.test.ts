import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { evaluatePolicy, loadPolicyFile, renderSarif, type Decision } from '@agent-owners/core';
import { getChangedFiles, getCommitMessages } from '../src/git.js';
import { registerCheck } from '../src/commands/check.js';

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core');
  return {
    ...actual,
    evaluatePolicy: vi.fn(),
    loadPolicyFile: vi.fn(),
    renderSarif: vi.fn(),
  };
});

vi.mock('../src/git.js', () => ({
  getChangedFiles: vi.fn(),
  getCommitEmails: vi.fn(() => []),
  getCommitMessages: vi.fn(),
  getCommitNames: vi.fn(() => []),
  getCurrentActor: vi.fn(() => undefined),
}));

const approval: Decision = {
  effect: 'require_approval',
  matchedRules: [],
  detectedActions: ['open_pr'],
  riskScore: 45,
  riskLevel: 'medium',
  requiredReviewers: [],
  labelsToApply: [],
  explanation: 'Review required.',
};

function program(): Command {
  const command = new Command();
  command.exitOverride();
  registerCheck(command);
  return command;
}

describe('check command SARIF output', () => {
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
    vi.mocked(loadPolicyFile).mockResolvedValue({ version: 1 });
    vi.mocked(getChangedFiles).mockReturnValue(['src/index.ts']);
    vi.mocked(getCommitMessages).mockReturnValue(['feat: change']);
    vi.mocked(evaluatePolicy).mockReturnValue(approval);
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders SARIF as JSON', async () => {
    const sarif = { version: '2.1.0', runs: [] };
    vi.mocked(renderSarif).mockReturnValue(sarif as never);

    await program().parseAsync([
      'node',
      'agentowners',
      'check',
      '--output',
      'sarif',
      '--actor',
      'agent',
    ]);

    expect(renderSarif).toHaveBeenCalledWith(approval);
    expect(JSON.parse(stdout)).toEqual(sarif);
    expect(stderr).toBe('');
  });

  it('fails loudly for an unsupported output format before reading Git', async () => {
    await program().parseAsync(['node', 'agentowners', 'check', '--output', 'xml']);

    expect(process.exit).toHaveBeenCalledWith(64);
    expect(stderr).toContain('Output format must be one of: text, json, sarif.');
    expect(getChangedFiles).not.toHaveBeenCalled();
    expect(stdout).toBe('');
  });
});
