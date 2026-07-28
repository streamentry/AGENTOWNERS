import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import {
  loadPolicyFile,
  loadPolicyFixtureFile,
  runPolicyFixtureSuite,
  type PolicyFixtureSuiteResult,
} from '@agent-owners/core';
import { registerTest } from '../src/commands/test.js';

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core');
  return {
    ...actual,
    loadPolicyFile: vi.fn(),
    loadPolicyFixtureFile: vi.fn(),
    runPolicyFixtureSuite: vi.fn(),
  };
});

const passingResult: PolicyFixtureSuiteResult = {
  passed: true,
  total: 1,
  passedCount: 1,
  failedCount: 0,
  cases: [{ name: 'docs are allowed', passed: true, failures: [] }],
};

const failingResult: PolicyFixtureSuiteResult = {
  passed: false,
  total: 1,
  passedCount: 0,
  failedCount: 1,
  cases: [
    {
      name: 'workflows are blocked',
      passed: false,
      failures: [{ field: 'decision', expected: 'block', actual: 'allow' }],
    },
  ],
};

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerTest(program);
  return program;
}

function argumentsFor(output = 'text'): string[] {
  return [
    'node',
    'agentowners',
    'test',
    '--policy',
    '.github/AGENTOWNERS.yml',
    '--fixtures',
    '.agentowners/fixtures.yml',
    '--output',
    output,
  ];
}

describe('test command', () => {
  let stdout = '';
  let stderr = '';

  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(loadPolicyFixtureFile).mockResolvedValue({
      version: 1,
      cases: [],
    } as never);
    vi.mocked(runPolicyFixtureSuite).mockReturnValue(passingResult);
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('publishes explicit policy, fixture, and output options', () => {
    const command = makeProgram().commands.find((candidate) => candidate.name() === 'test');
    expect(command?.description()).toContain('policy fixture');
    expect(command?.options.map((option) => option.flags)).toEqual(
      expect.arrayContaining(['--policy <path>', '--fixtures <path>', '--output <format>']),
    );
  });

  it('prints deterministic text and exits zero when every case passes', async () => {
    await makeProgram().parseAsync(argumentsFor());

    expect(stdout).toBe('PASS docs are allowed\n\n1 passed, 0 failed\n');
    expect(stderr).toBe('');
    expect(process.exitCode).toBe(0);
  });

  it('prints field diagnostics and exits one on assertion failure', async () => {
    vi.mocked(runPolicyFixtureSuite).mockReturnValue(failingResult);

    await makeProgram().parseAsync(argumentsFor());

    expect(stdout).toBe(
      'FAIL workflows are blocked\n  decision: expected "block", received "allow"\n\n0 passed, 1 failed\n',
    );
    expect(stderr).toBe('');
    expect(process.exitCode).toBe(1);
  });

  it('emits a stable JSON result for machine consumers', async () => {
    await makeProgram().parseAsync(argumentsFor('json'));

    expect(JSON.parse(stdout)).toEqual({
      schemaVersion: 1,
      status: 'complete',
      result: passingResult,
    });
    expect(process.exitCode).toBe(0);
  });

  it('rejects unknown output before reading files', async () => {
    await makeProgram().parseAsync(argumentsFor('xml'));

    expect(process.exitCode).toBe(64);
    expect(stderr).toContain('Unsupported output format: xml');
    expect(loadPolicyFile).not.toHaveBeenCalled();
    expect(loadPolicyFixtureFile).not.toHaveBeenCalled();
  });

  it('fails with 64 when mandatory paths are missing', async () => {
    await makeProgram().parseAsync(['node', 'agentowners', 'test']);

    expect(process.exitCode).toBe(64);
    expect(stderr).toContain('Missing required options: --policy, --fixtures');
  });

  it('emits versioned JSON errors when JSON output was requested', async () => {
    await makeProgram().parseAsync(['node', 'agentowners', 'test', '--output', 'json']);

    expect(process.exitCode).toBe(64);
    expect(JSON.parse(stderr)).toEqual({
      schemaVersion: 1,
      status: 'error',
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid policy fixture command input.',
        detail: 'Missing required options: --policy, --fixtures',
      },
    });
  });

  it('distinguishes invalid policy and fixture data without leaking internals', async () => {
    vi.mocked(loadPolicyFile).mockRejectedValueOnce(new Error('sensitive policy contents'));
    await makeProgram().parseAsync(argumentsFor());
    expect(process.exitCode).toBe(65);
    expect(stderr).toContain('Unable to load or validate policy.');
    expect(stderr).not.toContain('sensitive');

    stderr = '';
    process.exitCode = undefined;
    vi.mocked(loadPolicyFixtureFile).mockRejectedValueOnce(new Error('sensitive fixture contents'));
    await makeProgram().parseAsync(argumentsFor());
    expect(process.exitCode).toBe(66);
    expect(stderr).toContain('Unable to load or validate fixtures.');
    expect(stderr).not.toContain('sensitive');
  });

  it('fails with 70 for an unexpected runner error', async () => {
    vi.mocked(runPolicyFixtureSuite).mockImplementation(() => {
      throw new Error('unexpected internals');
    });

    await makeProgram().parseAsync(argumentsFor());

    expect(process.exitCode).toBe(70);
    expect(stderr).toContain('Policy fixture execution failed unexpectedly.');
    expect(stderr).not.toContain('unexpected internals');
  });
});
