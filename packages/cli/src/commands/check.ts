import * as path from 'path';
import { Command } from 'commander';
import {
  loadPolicyFile,
  classifyFiles,
  inferActions,
  detectAgent,
  evaluatePolicy,
  renderVerdict,
  renderSarif,
  type AgentOwnersPolicy,
  type Decision,
} from '@agent-owners/core';
import {
  getChangedFiles,
  getCommitEmails,
  getCommitMessages,
  getCommitNames,
  getCurrentActor,
} from '../git.js';

type CheckOptions = {
  policy: string;
  base: string;
  head: string;
  actor?: string;
  output: string;
  mode: 'advisory' | 'enforcement' | 'dry-run';
};

type GitInputs = {
  changedFiles: string[];
  commitMessages: string[];
  commitEmails: string[];
  commitNames: string[];
};

const CHECK_MODES = ['advisory', 'enforcement', 'dry-run'] as const;

function validateOutput(output: string): boolean {
  if (['text', 'json', 'sarif'].includes(output)) return true;
  process.stderr.write('Output format must be one of: text, json, sarif.\n');
  process.exit(64);
  return false;
}

function validateMode(mode: string): mode is CheckOptions['mode'] {
  if (CHECK_MODES.includes(mode as CheckOptions['mode'])) return true;
  process.stderr.write('Mode must be one of: advisory, enforcement, dry-run.\n');
  process.exit(64);
  return false;
}

async function loadPolicy(options: CheckOptions): Promise<AgentOwnersPolicy | undefined> {
  try {
    return await loadPolicyFile(path.resolve(process.cwd(), options.policy));
  } catch (error: unknown) {
    process.stderr.write(
      `Error loading policy: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
    return undefined;
  }
}

function readGit(options: CheckOptions): GitInputs | undefined {
  try {
    return {
      changedFiles: getChangedFiles(options.base, options.head, process.cwd()),
      commitMessages: getCommitMessages(options.base, options.head, process.cwd()),
      commitEmails: getCommitEmails(options.base, options.head, process.cwd()),
      commitNames: getCommitNames(options.base, options.head, process.cwd()),
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error reading git range ${options.base}..${options.head}: ${detail}\n`);
    process.exit(2);
    return undefined;
  }
}

function evaluate(policy: AgentOwnersPolicy, inputs: GitInputs, actor: string): Decision {
  const filesClassification = classifyFiles(inputs.changedFiles);
  const detectedActions = inferActions({
    eventType: 'pull_request.opened',
    changedFiles: inputs.changedFiles,
  });
  const agentDetection = detectAgent({
    actor,
    commitMessages: inputs.commitMessages,
    commitEmails: inputs.commitEmails,
    commitNames: inputs.commitNames,
    policy,
  });
  return evaluatePolicy({
    policy,
    agentDetection,
    detectedActions,
    changedFiles: inputs.changedFiles,
    filesClassification,
    actor,
  });
}

function writeDecision(decision: Decision, output: string, actor: string): void {
  if (output === 'json') {
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  } else if (output === 'sarif') {
    process.stdout.write(`${JSON.stringify(renderSarif(decision), null, 2)}\n`);
  } else {
    process.stdout.write(`${renderVerdict(decision, { actor })}\n`);
  }
}

async function executeCheck(options: CheckOptions): Promise<void> {
  if (!validateOutput(options.output)) return;
  if (!validateMode(options.mode)) return;
  const policy = await loadPolicy(options);
  if (!policy) return;
  const inputs = readGit(options);
  if (!inputs) return;
  const actor = options.actor ?? getCurrentActor(process.cwd()) ?? 'unknown';
  const decision = evaluate(policy, inputs, actor);
  writeDecision(decision, options.output, actor);
  process.exit(decision.effect === 'block' && options.mode === 'enforcement' ? 1 : 0);
}

export function registerCheck(program: Command): void {
  program
    .command('check')
    .description('Analyze changed files against AGENTOWNERS policy')
    .option('--policy <path>', 'Path to policy file', '.github/AGENTOWNERS.yml')
    .option('--base <ref>', 'Base git ref', 'main')
    .option('--head <ref>', 'Head git ref', 'HEAD')
    .option('--actor <name>', 'Actor name for agent detection')
    .option('--output <format>', 'Output format: text | json | sarif', 'text')
    .option('--mode <mode>', 'Mode: advisory | enforcement | dry-run', 'advisory')
    .action(executeCheck);
}
