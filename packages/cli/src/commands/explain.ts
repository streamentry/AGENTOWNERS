import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { z } from 'zod';
import { agentActionSchema, type Decision } from '@agent-owners/core';

const effectSchema = z.enum(['allow', 'require_approval', 'block']);
const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
const matchedRuleSchema = z
  .object({
    name: z.string(),
    effect: effectSchema,
    reason: z.string(),
    matchedConditions: z.array(z.string()).optional(),
    matchedFiles: z.array(z.string()).optional(),
    reviewers: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
  })
  .strict();
const decisionSchema = z
  .object({
    effect: effectSchema,
    matchedRules: z.array(matchedRuleSchema),
    matchedAgent: z.string().optional(),
    detectedActions: z.array(agentActionSchema),
    riskScore: z.number().int().min(0).max(100),
    riskLevel: riskLevelSchema,
    requiredReviewers: z.array(z.string()),
    labelsToApply: z.array(z.string()),
    explanation: z.string(),
  })
  .strict();

const ANSI_ESCAPE = new RegExp(
  String.raw`\u001B(?:\][^\u0007]*(?:\u0007|\u001B\\)|\[[0-?]*[ -/]*[@-~])`,
  'g',
);
const TERMINAL_CONTROLS = new RegExp(
  String.raw`[\u0000-\u0008\u000B-\u000D\u000E-\u001F\u007F]`,
  'g',
);

function safeText(value: string): string {
  return value.replace(ANSI_ESCAPE, '').replace(TERMINAL_CONTROLS, '');
}

function safeInlineText(value: string): string {
  return safeText(value).replace(/\n/g, ' ');
}

export function parseDecision(raw: string): Decision | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = decisionSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function formatDecision(decision: Decision): string {
  const lines: string[] = [];

  lines.push(`Decision: \x1b[1m${safeInlineText(decision.effect.toUpperCase())}\x1b[0m`);
  lines.push('');

  if (decision.explanation) {
    lines.push(safeText(decision.explanation));
    lines.push('');
  }

  lines.push(`Risk score: ${decision.riskScore} (${safeInlineText(decision.riskLevel)})`);
  lines.push('');

  if (decision.matchedRules.length > 0) {
    lines.push('Matched rules:');
    for (const rule of decision.matchedRules) {
      lines.push(`  - ${safeInlineText(rule.name)} → ${safeInlineText(rule.effect)}`);
      if (rule.reason) lines.push(`      ${safeInlineText(rule.reason)}`);
    }
    lines.push('');
  }

  if (decision.detectedActions.length > 0) {
    lines.push(`Detected actions: ${decision.detectedActions.map(safeInlineText).join(', ')}`);
    lines.push('');
  }

  if (decision.requiredReviewers.length > 0) {
    lines.push(`Required reviewers: ${decision.requiredReviewers.map(safeInlineText).join(', ')}`);
    lines.push('');
  }

  if (decision.labelsToApply.length > 0) {
    lines.push(`Labels to apply: ${decision.labelsToApply.map(safeInlineText).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function registerExplain(program: Command): void {
  program
    .command('explain')
    .description('Explain a decision JSON file')
    .option('--decision <path>', 'Path to decision JSON file', 'decision.json')
    .action((options: { decision: string }) => {
      const filePath = path.resolve(process.cwd(), options.decision);

      let raw: string;
      try {
        raw = readFileSync(filePath, 'utf8');
      } catch {
        process.stderr.write(`Error: cannot read decision file at ${safeText(filePath)}\n`);
        process.exit(1);
        return;
      }

      const decision = parseDecision(raw);
      if (decision === null) {
        process.stderr.write(
          `Error: ${safeText(filePath)} is not a valid AGENTOWNERS decision JSON\n`,
        );
        process.exit(1);
        return;
      }

      process.stdout.write(formatDecision(decision));
    });
}
