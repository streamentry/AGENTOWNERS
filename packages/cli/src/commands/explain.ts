import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';
import { Command } from 'commander';
import type {
  AgentAction,
  AgentDetectionConfidence,
  AuditRecord,
  Decision,
  MatchedRule,
  RiskLevel,
} from '@agent-owners/core';

type ExplainableInput = {
  decision: Decision;
  audit?: AuditRecord;
  verifiedSha256?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEffect(value: unknown): value is Decision['effect'] {
  return value === 'allow' || value === 'require_approval' || value === 'block';
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical';
}

function isConfidence(value: unknown): value is AgentDetectionConfidence {
  return value === 'confirmed' || value === 'likely' || value === 'possible' || value === 'unknown';
}

function isRiskScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

const AGENT_ACTIONS = new Set<AgentAction>([
  'open_pr',
  'update_pr',
  'comment',
  'review_comment',
  'approve_pr',
  'request_changes',
  'label_issue',
  'close_issue',
  'reopen_issue',
  'assign_issue',
  'edit_workflows',
  'modify_tests',
  'modify_docs',
  'modify_dependencies',
  'modify_auth',
  'modify_infra',
  'touch_secrets',
  'change_permissions',
  'merge_pr',
]);

function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === 'string' && AGENT_ACTIONS.has(value as AgentAction);
}

function isMatchedRule(value: unknown): value is MatchedRule {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    isEffect(value.effect) &&
    typeof value.reason === 'string'
  );
}

function isDecision(value: unknown): value is Decision {
  return (
    isObject(value) &&
    isEffect(value.effect) &&
    Array.isArray(value.matchedRules) &&
    value.matchedRules.every(isMatchedRule) &&
    Array.isArray(value.detectedActions) &&
    value.detectedActions.every(isAgentAction) &&
    isRiskScore(value.riskScore) &&
    isRiskLevel(value.riskLevel) &&
    Array.isArray(value.requiredReviewers) &&
    value.requiredReviewers.every((reviewer): reviewer is string => typeof reviewer === 'string') &&
    Array.isArray(value.labelsToApply) &&
    value.labelsToApply.every((label): label is string => typeof label === 'string') &&
    typeof value.explanation === 'string'
  );
}

function isAuditRecord(value: unknown): value is AuditRecord {
  return (
    isObject(value) &&
    value.version === 1 &&
    typeof value.timestamp === 'string' &&
    typeof value.actor === 'string' &&
    isConfidence(value.confidence) &&
    isEffect(value.decision) &&
    isRiskScore(value.riskScore) &&
    isRiskLevel(value.riskLevel) &&
    Array.isArray(value.detectedActions) &&
    value.detectedActions.every(isAgentAction) &&
    Array.isArray(value.changedFiles) &&
    value.changedFiles.every((file): file is string => typeof file === 'string') &&
    Array.isArray(value.matchedRules) &&
    value.matchedRules.every(isMatchedRule) &&
    Array.isArray(value.requiredReviewers) &&
    value.requiredReviewers.every((reviewer): reviewer is string => typeof reviewer === 'string') &&
    (value.labelsToApply === undefined ||
      (Array.isArray(value.labelsToApply) &&
        value.labelsToApply.every((label): label is string => typeof label === 'string')))
  );
}

function decisionFromAudit(audit: AuditRecord): Decision {
  return {
    effect: audit.decision,
    matchedRules: audit.matchedRules.map((rule) => ({
      name: rule.name,
      effect: rule.effect as MatchedRule['effect'],
      reason: rule.reason,
    })),
    matchedAgent: audit.matchedAgent,
    detectedActions: audit.detectedActions,
    riskScore: audit.riskScore,
    riskLevel: audit.riskLevel as RiskLevel,
    requiredReviewers: audit.requiredReviewers,
    labelsToApply: audit.labelsToApply ?? [],
    explanation: '',
  };
}

function parseInput(raw: unknown, verifiedSha256?: string): ExplainableInput | null {
  if (isDecision(raw)) return { decision: raw, verifiedSha256 };
  if (isAuditRecord(raw)) return { decision: decisionFromAudit(raw), audit: raw, verifiedSha256 };
  return null;
}

function writeAuditContext(lines: string[], audit: AuditRecord): void {
  lines.push(`Audit timestamp: ${audit.timestamp}`);
  lines.push(`Actor: ${audit.actor}`);
  if (audit.matchedAgent) lines.push(`Matched agent: ${audit.matchedAgent}`);
  if (audit.repository) lines.push(`Repository: ${audit.repository}`);
  if (audit.event) lines.push(`Event: ${audit.event}`);
  lines.push(`Changed files: ${audit.changedFiles.length}`);
  lines.push(`Detection confidence: ${audit.confidence}`);
  lines.push('');
}

function writeDecision(input: ExplainableInput): void {
  const { decision, audit } = input;
  const lines: string[] = [];
  if (audit) writeAuditContext(lines, audit);
  if (input.verifiedSha256) {
    lines.push(`SHA-256 verified: ${input.verifiedSha256}`, '');
  }

  lines.push(`Decision: \x1b[1m${decision.effect.toUpperCase()}\x1b[0m`, '');
  if (decision.explanation) lines.push(decision.explanation, '');
  lines.push(`Risk score: ${decision.riskScore} (${decision.riskLevel})`, '');

  if (decision.matchedRules.length > 0) {
    lines.push('Matched rules:');
    for (const rule of decision.matchedRules) {
      lines.push(`  - ${rule.name} → ${rule.effect}`, `      ${rule.reason}`);
    }
    lines.push('');
  }

  if (decision.detectedActions.length > 0) {
    lines.push(`Detected actions: ${decision.detectedActions.join(', ')}`, '');
  }
  if (decision.requiredReviewers.length > 0) {
    lines.push(`Required reviewers: ${decision.requiredReviewers.join(', ')}`, '');
  }
  if (decision.labelsToApply.length > 0) {
    lines.push(`Labels to apply: ${decision.labelsToApply.join(', ')}`, '');
  }

  process.stdout.write(lines.join('\n'));
}

function readInput(filePath: string, expectedSha256?: string): ExplainableInput | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    process.stderr.write(`Error: cannot read decision file at ${filePath}\n`);
    process.exit(1);
    return null;
  }

  if (expectedSha256 !== undefined) {
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) {
      throw new Error('--sha256 must be a 64-character hexadecimal digest');
    }

    const actualSha256 = createHash('sha256').update(raw, 'utf8').digest('hex');
    if (actualSha256 !== expectedSha256.toLowerCase()) {
      throw new Error(`${filePath} does not match the supplied SHA-256 digest`);
    }
  }

  try {
    const input = parseInput(JSON.parse(raw) as unknown, expectedSha256?.toLowerCase());
    if (input) return input;
  } catch {
    // Fall through to the same bounded diagnostic as an unrecognized shape.
  }

  process.stderr.write(`Error: ${filePath} is not valid Decision or audit JSON\n`);
  process.exit(1);
  return null;
}

export function registerExplain(program: Command): void {
  program
    .command('explain')
    .description('Explain a Decision or AGENTOWNERS audit JSON file')
    .option('--decision <path>', 'Path to decision or audit JSON file', 'decision.json')
    .option('--sha256 <digest>', 'Verify the SHA-256 digest of the input bytes before explaining')
    .action((options: { decision: string; sha256?: string }) => {
      const filePath = path.resolve(process.cwd(), options.decision);
      try {
        const input = readInput(filePath, options.sha256);
        if (input) writeDecision(input);
      } catch (error: unknown) {
        process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    });
}
