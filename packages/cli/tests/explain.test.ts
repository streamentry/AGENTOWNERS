import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';
import { registerExplain } from '../src/commands/explain.js';

const temporaryDirectories: string[] = [];

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerExplain(program);
  return program;
}

function writeDecision(value: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), 'agentowners-explain-'));
  temporaryDirectories.push(directory);
  const filePath = join(directory, 'decision.json');
  writeFileSync(filePath, JSON.stringify(value), 'utf8');
  return filePath;
}

const validDecision = {
  effect: 'require_approval',
  matchedRules: [
    {
      name: 'Review dependencies',
      effect: 'require_approval',
      reason: 'Dependency changes require review.',
    },
  ],
  detectedActions: ['open_pr', 'modify_dependencies'],
  riskScore: 50,
  riskLevel: 'high',
  requiredReviewers: ['@maintainers'],
  labelsToApply: ['ai-agent'],
  explanation: 'Review required.',
};

describe('explain command', () => {
  let stdout = '';
  let stderr = '';

  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('renders a validated decision for human inspection', async () => {
    const filePath = writeDecision(validDecision);

    await makeProgram().parseAsync(['node', 'agentowners', 'explain', '--decision', filePath]);

    expect(process.exit).not.toHaveBeenCalled();
    expect(stderr).toBe('');
    expect(stdout).toContain('Decision: \x1b[1mREQUIRE_APPROVAL\x1b[0m');
    expect(stdout).toContain('Detected actions: open_pr, modify_dependencies');
    expect(stdout).toContain('Required reviewers: @maintainers');
  });

  it('rejects valid JSON with an invalid decision shape', async () => {
    const filePath = writeDecision({ effect: 'allow' });

    await makeProgram().parseAsync(['node', 'agentowners', 'explain', '--decision', filePath]);

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(stderr).toContain('not a valid AGENTOWNERS decision JSON');
    expect(stdout).toBe('');
  });

  it('strips terminal control sequences from untrusted decision text', async () => {
    const filePath = writeDecision({
      ...validDecision,
      explanation: '\u001b[31munsafe\u001b[0m',
      matchedRules: [
        {
          name: '\u001b]0;spoofed title\u0007Rule\nForged line',
          effect: 'require_approval',
          reason: 'safe reason',
        },
      ],
    });

    await makeProgram().parseAsync(['node', 'agentowners', 'explain', '--decision', filePath]);

    expect(stdout).toContain('unsafe');
    expect(stdout).toContain('Rule Forged line');
    expect(stdout).not.toContain('\u001b[31m');
    expect(stdout).not.toContain('\u001b]0;');
  });
});
