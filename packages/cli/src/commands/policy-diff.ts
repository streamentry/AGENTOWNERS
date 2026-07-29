import * as path from 'path';
import { Command } from 'commander';
import { diffPolicies, loadPolicyFile, type PolicyDiff } from '@agent-owners/core';

type PolicyDiffOptions = {
  base: string;
  proposed: string;
  format: string;
  failOnChange?: boolean;
};

type PolicyDiffErrorCode = 'INVALID_INPUT' | 'INVALID_POLICY' | 'INTERNAL_ERROR';

const errorDetails: Record<PolicyDiffErrorCode, { exitCode: number; message: string }> = {
  INVALID_INPUT: { exitCode: 64, message: 'Invalid policy diff command input.' },
  INVALID_POLICY: { exitCode: 65, message: 'Unable to load or validate policy input.' },
  INTERNAL_ERROR: { exitCode: 70, message: 'Policy diff failed unexpectedly.' },
};

function writeError(code: PolicyDiffErrorCode, format: 'text' | 'json'): void {
  const error = errorDetails[code];
  if (format === 'json') {
    process.stderr.write(
      `${JSON.stringify({
        schemaVersion: 1,
        status: 'error',
        error: { code, message: error.message },
      })}\n`,
    );
  } else {
    process.stderr.write(`${error.message}\n`);
  }
  process.exitCode = error.exitCode;
}

function writeDiff(diff: PolicyDiff, format: 'text' | 'json', failOnChange: boolean): void {
  if (format === 'json') {
    process.stdout.write(
      `${JSON.stringify({ schemaVersion: 1, status: 'complete', diff }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(
      `Policy diff: ${diff.identical ? 'identical' : `${diff.changes.length} change(s)`}.\n` +
        `Base digest: ${diff.baseDigest}.\n` +
        `Proposed digest: ${diff.proposedDigest}.\n` +
        diff.changes.map((change) => `- ${change.kind} ${change.path}`).join('\n') +
        (diff.changes.length > 0 ? '\n' : ''),
    );
  }
  process.exitCode = failOnChange && !diff.identical ? 1 : 0;
}

export async function runPolicyDiff(options: PolicyDiffOptions): Promise<void> {
  const format = options.format === 'json' || options.format === 'text' ? options.format : null;
  if (format === null) {
    writeError('INVALID_INPUT', 'text');
    return;
  }

  let base: Awaited<ReturnType<typeof loadPolicyFile>>;
  let proposed: Awaited<ReturnType<typeof loadPolicyFile>>;
  try {
    [base, proposed] = await Promise.all([
      loadPolicyFile(path.resolve(process.cwd(), options.base)),
      loadPolicyFile(path.resolve(process.cwd(), options.proposed)),
    ]);
  } catch {
    writeError('INVALID_POLICY', format);
    return;
  }

  try {
    writeDiff(diffPolicies(base, proposed), format, options.failOnChange === true);
  } catch {
    writeError('INTERNAL_ERROR', format);
  }
}

export function registerPolicyDiff(program: Command): void {
  program
    .command('policy-diff')
    .description('Compare two policies without printing policy values')
    .requiredOption('--base <path>', 'Base policy file')
    .requiredOption('--proposed <path>', 'Proposed policy file')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--fail-on-change', 'Exit one when the policies differ', false)
    .action((options: PolicyDiffOptions) => runPolicyDiff(options));
}
