import * as path from 'path';
import { Command } from 'commander';
import {
  classifyFiles,
  detectAgent,
  evaluatePolicy,
  inferActions,
  loadPolicyFile,
  type AgentOwnersPolicy,
  type Decision,
} from '@agent-owners/core';
import { getChangedFiles, getCommitEmails, getCommitMessages, getCommitNames } from '../git.js';

type SelfCheckOptions = {
  policy?: string;
  base?: string;
  head?: string;
  actor?: string;
  outputVersion: string;
};

type ResolvedOptions = {
  policy: string;
  base: string;
  head: string;
  actor: string;
};

type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_OUTPUT_VERSION'
  | 'INVALID_POLICY'
  | 'INVALID_GIT_RANGE'
  | 'INTERNAL_ERROR';

const ERROR_DETAILS: Record<
  ErrorCode,
  { exitCode: number; message: string; recommendation: string }
> = {
  INVALID_INPUT: {
    exitCode: 64,
    message: 'Mandatory self-check inputs are missing.',
    recommendation: 'fix_inputs',
  },
  UNSUPPORTED_OUTPUT_VERSION: {
    exitCode: 64,
    message: 'The requested output version is unsupported.',
    recommendation: 'upgrade_integration',
  },
  INVALID_POLICY: {
    exitCode: 65,
    message: 'Unable to load or validate the policy.',
    recommendation: 'fix_policy',
  },
  INVALID_GIT_RANGE: {
    exitCode: 66,
    message: 'Unable to resolve the requested git range.',
    recommendation: 'fix_git_range',
  },
  INTERNAL_ERROR: {
    exitCode: 70,
    message: 'Self-check failed unexpectedly.',
    recommendation: 'report_error',
  },
};

function writeError(code: ErrorCode, details?: string[]): void {
  const error = ERROR_DETAILS[code];
  const output = {
    schemaVersion: 1,
    status: 'error',
    error: {
      code,
      message: error.message,
      ...(details ? { details } : {}),
    },
    recommendedNextAction: error.recommendation,
  };

  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = error.exitCode;
}

function missingInputs(options: SelfCheckOptions): string[] {
  const required = [
    ['--policy', options.policy],
    ['--base', options.base],
    ['--head', options.head],
    ['--actor', options.actor],
  ] as const;

  return required
    .filter(([, value]) => value === undefined || value.trim().length === 0)
    .map(([flag]) => flag);
}

function recommendation(effect: Decision['effect']): string {
  if (effect === 'allow') return 'proceed';
  if (effect === 'require_approval') return 'request_approval';
  return 'revise_changes';
}

function decisionExitCode(effect: Decision['effect']): number {
  if (effect === 'allow') return 0;
  if (effect === 'require_approval') return 10;
  return 20;
}

function resolveOptions(options: SelfCheckOptions): ResolvedOptions | null {
  const missing = missingInputs(options);
  if (missing.length > 0) {
    writeError('INVALID_INPUT', missing);
    return null;
  }
  if (options.outputVersion !== '1') {
    writeError('UNSUPPORTED_OUTPUT_VERSION');
    return null;
  }

  return {
    policy: options.policy as string,
    base: options.base as string,
    head: options.head as string,
    actor: options.actor as string,
  };
}

async function loadPolicy(
  options: ResolvedOptions,
  cwd: string,
): Promise<AgentOwnersPolicy | null> {
  try {
    return await loadPolicyFile(path.resolve(cwd, options.policy));
  } catch {
    writeError('INVALID_POLICY');
    return null;
  }
}

function loadGitRange(
  options: ResolvedOptions,
  cwd: string,
): {
  changedFiles: string[];
  commitMessages: string[];
  commitEmails: string[];
  commitNames: string[];
} | null {
  try {
    return {
      changedFiles: getChangedFiles(options.base, options.head, cwd),
      commitMessages: getCommitMessages(options.base, options.head, cwd),
      commitEmails: getCommitEmails(options.base, options.head, cwd),
      commitNames: getCommitNames(options.base, options.head, cwd),
    };
  } catch {
    writeError('INVALID_GIT_RANGE');
    return null;
  }
}

function evaluateSelfCheck(
  options: ResolvedOptions,
  policy: AgentOwnersPolicy,
  changedFiles: string[],
  commitMessages: string[],
  commitEmails: string[],
  commitNames: string[],
): Decision {
  const filesClassification = classifyFiles(changedFiles);
  const detectedActions = inferActions({
    eventType: 'pull_request.opened',
    changedFiles,
  });
  const agentDetection = detectAgent({
    actor: options.actor,
    commitMessages,
    commitEmails,
    commitNames,
    policy,
  });

  return evaluatePolicy({
    policy,
    agentDetection,
    detectedActions,
    changedFiles,
    filesClassification,
    actor: options.actor,
  });
}

function writeSuccess(options: ResolvedOptions, decision: Decision): void {
  const output = {
    schemaVersion: 1,
    status: 'complete',
    inputs: options,
    decision: decision.effect,
    risk: { score: decision.riskScore, level: decision.riskLevel },
    detectedActions: decision.detectedActions,
    blockedActions: decision.effect === 'block' ? decision.detectedActions : [],
    matchedRules: decision.matchedRules,
    requiredReviewers: decision.requiredReviewers,
    recommendedNextAction: recommendation(decision.effect),
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = decisionExitCode(decision.effect);
}

async function runSelfCheck(rawOptions: SelfCheckOptions): Promise<void> {
  const options = resolveOptions(rawOptions);
  if (!options) return;

  const cwd = process.cwd();
  const policy = await loadPolicy(options, cwd);
  if (!policy) return;

  const gitRange = loadGitRange(options, cwd);
  if (!gitRange) return;

  try {
    const decision = evaluateSelfCheck(
      options,
      policy,
      gitRange.changedFiles,
      gitRange.commitMessages,
      gitRange.commitEmails,
      gitRange.commitNames,
    );
    writeSuccess(options, decision);
  } catch {
    writeError('INTERNAL_ERROR');
  }
}

export function registerSelfCheck(program: Command): void {
  program
    .command('self-check')
    .description('Run a machine-readable pre-PR policy check')
    .option('--policy <path>', 'Path to policy file')
    .option('--base <ref>', 'Base git ref')
    .option('--head <ref>', 'Head git ref')
    .option('--actor <name>', 'Explicit actor name')
    .option('--output-version <version>', 'Output contract version', '1')
    .action(runSelfCheck);
}
