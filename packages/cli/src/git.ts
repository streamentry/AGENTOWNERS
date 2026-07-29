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

export function getCommitIdentities(
  base: string,
  head: string,
  cwd?: string,
): { commitEmails: string[]; commitNames: string[] } {
  const output = exec(
    'git',
    ['log', '--format=%ae%x00%an', '--end-of-options', `${base}..${head}`],
    cwd,
  );
  if (!output) return { commitEmails: [], commitNames: [] };

  const fields = output.split('\n').flatMap((record) => record.split('\0'));
  const commitEmails: string[] = [];
  const commitNames: string[] = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    if (fields[index]) commitEmails.push(fields[index]);
    if (fields[index + 1]) commitNames.push(fields[index + 1]);
  }
  return { commitEmails, commitNames };
}

export function getCurrentActor(cwd?: string): string | null {
  try {
    const name = exec('git', ['config', 'user.name'], cwd);
    return name || null;
  } catch {
    return null;
  }
}
