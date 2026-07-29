import * as path from 'path';
import { Command } from 'commander';
import {
  loadPolicyFile,
  loadPolicyFixtureFile,
  runPolicyFixtureSuite,
  type AgentOwnersPolicy,
  type PolicyFixtureSuite,
  type PolicyFixtureSuiteResult,
} from '@agent-owners/core';

type TestOptions = {
  policy?: string;
  fixtures?: string;
  output: string;
};

type ResolvedTestOptions = {
  policy: string;
  fixtures: string;
  output: 'text' | 'json';
};

type TestErrorCode = 'INVALID_INPUT' | 'INVALID_POLICY' | 'INVALID_FIXTURES' | 'INTERNAL_ERROR';

const ERROR_DETAILS: Record<TestErrorCode, { exitCode: number; message: string }> = {
  INVALID_INPUT: { exitCode: 64, message: 'Invalid policy fixture command input.' },
  INVALID_POLICY: { exitCode: 65, message: 'Unable to load or validate policy.' },
  INVALID_FIXTURES: { exitCode: 66, message: 'Unable to load or validate fixtures.' },
  INTERNAL_ERROR: { exitCode: 70, message: 'Policy fixture execution failed unexpectedly.' },
};

function writeError(code: TestErrorCode, output: string, detail?: string): void {
  const error = ERROR_DETAILS[code];
  if (output === 'json') {
    process.stderr.write(
      `${JSON.stringify({
        schemaVersion: 1,
        status: 'error',
        error: { code, message: error.message, ...(detail ? { detail } : {}) },
      })}\n`,
    );
  } else {
    process.stderr.write(`${detail ?? error.message}\n`);
  }
  process.exitCode = error.exitCode;
}

function resolveOptions(options: TestOptions): ResolvedTestOptions | null {
  if (options.output !== 'text' && options.output !== 'json') {
    writeError('INVALID_INPUT', 'text', `Unsupported output format: ${options.output}`);
    return null;
  }
  const missing = [
    !options.policy ? '--policy' : null,
    !options.fixtures ? '--fixtures' : null,
  ].filter((value): value is string => value !== null);
  if (missing.length > 0) {
    writeError('INVALID_INPUT', options.output, `Missing required options: ${missing.join(', ')}`);
    return null;
  }
  return {
    policy: path.resolve(process.cwd(), options.policy as string),
    fixtures: path.resolve(process.cwd(), options.fixtures as string),
    output: options.output,
  };
}

async function loadInputs(
  options: ResolvedTestOptions,
): Promise<{ policy: AgentOwnersPolicy; fixtures: PolicyFixtureSuite } | null> {
  let policy: AgentOwnersPolicy;
  try {
    policy = await loadPolicyFile(options.policy);
  } catch {
    writeError('INVALID_POLICY', options.output);
    return null;
  }
  try {
    return { policy, fixtures: await loadPolicyFixtureFile(options.fixtures) };
  } catch {
    writeError('INVALID_FIXTURES', options.output);
    return null;
  }
}

function formatValue(value: unknown): string {
  return JSON.stringify(value);
}

function escapeControlCharacters(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControl = codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    return isControl ? `\\u${codePoint.toString(16).padStart(4, '0')}` : character;
  }).join('');
}

function writeText(result: PolicyFixtureSuiteResult): void {
  const lines: string[] = [];
  for (const fixture of result.cases) {
    lines.push(
      `${fixture.passed ? 'PASS' : 'FAIL'} ${escapeControlCharacters(fixture.name)}`,
    );
    for (const failure of fixture.failures) {
      lines.push(
        `  ${failure.field}: expected ${formatValue(failure.expected)}, received ${formatValue(failure.actual)}`,
      );
    }
  }
  lines.push('', `${result.passedCount} passed, ${result.failedCount} failed`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function writeResult(result: PolicyFixtureSuiteResult, output: 'text' | 'json'): void {
  if (output === 'json') {
    process.stdout.write(
      `${JSON.stringify({ schemaVersion: 1, status: 'complete', result }, null, 2)}\n`,
    );
  } else {
    writeText(result);
  }
  process.exitCode = result.passed ? 0 : 1;
}

async function runTest(rawOptions: TestOptions): Promise<void> {
  const options = resolveOptions(rawOptions);
  if (!options) return;
  const inputs = await loadInputs(options);
  if (!inputs) return;
  try {
    writeResult(runPolicyFixtureSuite(inputs.policy, inputs.fixtures), options.output);
  } catch {
    writeError('INTERNAL_ERROR', options.output);
  }
}

export function registerTest(program: Command): void {
  program
    .command('test')
    .description('Run portable policy fixture cases')
    .option('--policy <path>', 'Path to policy file')
    .option('--fixtures <path>', 'Path to versioned fixture suite')
    .option('--output <format>', 'Output format: text | json', 'text')
    .action(runTest);
}
