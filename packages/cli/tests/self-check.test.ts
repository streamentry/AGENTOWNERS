import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { evaluatePolicy, loadPolicyFile, type Decision } from '@agent-owners/core';
import { getChangedFiles, getCommitMessages } from '../src/git.js';
import { registerSelfCheck } from '../src/commands/self-check.js';

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core');
  return {
    ...actual,
    evaluatePolicy: vi.fn(),
    loadPolicyFile: vi.fn(),
  };
});

vi.mock('../src/git.js', () => ({
  getChangedFiles: vi.fn(),
  getCommitEmails: vi.fn(() => []),
  getCommitMessages: vi.fn(),
  getCommitNames: vi.fn(() => []),
}));

const requiredArguments = [
  '--policy',
  '.github/AGENTOWNERS.yml',
  '--base',
  'origin/main',
  '--head',
  'HEAD',
  '--actor',
  'coding-agent[bot]',
];

function makeDecision(effect: Decision['effect']): Decision {
  return {
    effect,
    matchedRules: [
      {
        name: 'Policy decision',
        effect,
        reason: 'Contract fixture.',
      },
    ],
    detectedActions: ['modify_tests'],
    riskScore: effect === 'block' ? 90 : effect === 'require_approval' ? 45 : 10,
    riskLevel: effect === 'block' ? 'critical' : effect === 'require_approval' ? 'medium' : 'low',
    requiredReviewers: effect === 'require_approval' ? ['maintainers'] : [],
    labelsToApply: [],
    explanation: 'Contract fixture.',
  };
}

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSelfCheck(program);
  return program;
}

describe('self-check command', () => {
  let stdout = '';
  let stderr = '';

  beforeEach(() => {
    process.exitCode = undefined;
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
    vi.mocked(loadPolicyFile).mockResolvedValue({ version: 1 });
    vi.mocked(getChangedFiles).mockReturnValue(['packages/core/src/schema.ts']);
    vi.mocked(getCommitMessages).mockReturnValue(['feat: update schema']);
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('publishes the explicit input and output-version options in help metadata', () => {
    const program = makeProgram();
    const command = program.commands.find((candidate) => candidate.name() === 'self-check');
    const flags = command?.options.map((option) => option.flags);

    expect(command?.description()).toContain('machine-readable');
    expect(flags).toEqual(
      expect.arrayContaining([
        '--policy <path>',
        '--base <ref>',
        '--head <ref>',
        '--actor <name>',
        '--output-version <version>',
      ]),
    );
  });

  it.each([
    ['allow', 0, 'proceed'],
    ['require_approval', 10, 'request_approval'],
    ['block', 20, 'revise_changes'],
  ] as const)('returns the stable %s contract', async (effect, exitCode, recommendation) => {
    vi.mocked(evaluatePolicy).mockReturnValue(makeDecision(effect));

    await makeProgram().parseAsync(['node', 'agentowners', 'self-check', ...requiredArguments]);

    const output = JSON.parse(stdout);
    expect(process.exitCode).toBe(exitCode);
    expect(output).toMatchObject({
      schemaVersion: 1,
      status: 'complete',
      decision: effect,
      detectedActions: ['modify_tests'],
      requiredReviewers: effect === 'require_approval' ? ['maintainers'] : [],
      recommendedNextAction: recommendation,
    });
    expect(output.blockedActions).toEqual(effect === 'block' ? ['modify_tests'] : []);
    expect(stderr).toBe('');
  });

  it('fails with 64 when a mandatory input is missing', async () => {
    await makeProgram().parseAsync(['node', 'agentowners', 'self-check', '--actor', 'agent']);

    expect(process.exitCode).toBe(64);
    expect(JSON.parse(stderr)).toMatchObject({
      status: 'error',
      error: { code: 'INVALID_INPUT' },
      recommendedNextAction: 'fix_inputs',
    });
    expect(stdout).toBe('');
  });

  it('fails with 64 for an unknown output version', async () => {
    await makeProgram().parseAsync([
      'node',
      'agentowners',
      'self-check',
      ...requiredArguments,
      '--output-version',
      '2',
    ]);

    expect(process.exitCode).toBe(64);
    expect(JSON.parse(stderr).error.code).toBe('UNSUPPORTED_OUTPUT_VERSION');
  });

  it('fails with 65 for an invalid policy', async () => {
    vi.mocked(loadPolicyFile).mockRejectedValue(new Error('secret policy contents'));

    await makeProgram().parseAsync(['node', 'agentowners', 'self-check', ...requiredArguments]);

    expect(process.exitCode).toBe(65);
    expect(JSON.parse(stderr)).toMatchObject({
      error: {
        code: 'INVALID_POLICY',
        message: 'Unable to load or validate the policy.',
      },
    });
    expect(stderr).not.toContain('secret policy contents');
  });

  it('fails with 66 and passes hostile refs as inert argv values', async () => {
    const hostileBase = 'main; touch /tmp/agentowners-pwned';
    vi.mocked(getChangedFiles).mockImplementation(() => {
      throw new Error('unknown revision');
    });

    await makeProgram().parseAsync([
      'node',
      'agentowners',
      'self-check',
      '--policy',
      '.github/AGENTOWNERS.yml',
      '--base',
      hostileBase,
      '--head',
      'HEAD',
      '--actor',
      'agent',
    ]);

    expect(getChangedFiles).toHaveBeenCalledWith(hostileBase, 'HEAD', process.cwd());
    expect(process.exitCode).toBe(66);
    expect(JSON.parse(stderr).error.code).toBe('INVALID_GIT_RANGE');
  });

  it('fails with 70 for an unexpected evaluation error', async () => {
    vi.mocked(evaluatePolicy).mockImplementation(() => {
      throw new Error('unexpected internals');
    });

    await makeProgram().parseAsync(['node', 'agentowners', 'self-check', ...requiredArguments]);

    expect(process.exitCode).toBe(70);
    expect(JSON.parse(stderr)).toMatchObject({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Self-check failed unexpectedly.',
      },
      recommendedNextAction: 'report_error',
    });
    expect(stderr).not.toContain('unexpected internals');
  });
});
