// Git helper functions using child_process.execFileSync.
// Refs are passed as argv, never interpreted by a shell.

import { execFileSync } from 'child_process';

function exec(cmd: string, args: string[], cwd?: string): string {
  const result = execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result.trim();
}

export function getChangedFiles(base: string, head: string, cwd?: string): string[] {
  const output = exec('git', ['diff', '--name-only', '--end-of-options', base, head, '--'], cwd);
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

export function getCommitMessages(base: string, head: string, cwd?: string): string[] {
  const output = exec(
    'git',
    ['log', '--format=%s%n%b', '--end-of-options', `${base}..${head}`],
    cwd,
  );
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

export function getCommitEmails(base: string, head: string, cwd?: string): string[] {
  const output = exec(
    'git',
    ['log', '--format=%ae', '--end-of-options', `${base}..${head}`],
    cwd,
  );
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

export function getCommitNames(base: string, head: string, cwd?: string): string[] {
  const output = exec(
    'git',
    ['log', '--format=%an', '--end-of-options', `${base}..${head}`],
    cwd,
  );
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

export function getCurrentActor(cwd?: string): string | null {
  try {
    const name = exec('git', ['config', 'user.name'], cwd);
    return name || null;
  } catch {
    return null;
  }
}
