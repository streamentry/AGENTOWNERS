// Git helper functions using child_process.execFileSync.
// Refs are passed as argv, never interpreted by a shell.

import { execFileSync } from 'child_process';

const REPOSITORY_REDIRECT_ENVIRONMENT = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
] as const;

function exec(cmd: string, args: string[], cwd?: string): string {
  const environment = { ...process.env };
  for (const name of REPOSITORY_REDIRECT_ENVIRONMENT) {
    delete environment[name];
  }
  const result = execFileSync(cmd, args, {
    cwd,
    env: environment,
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

export function getCommitMessage(commit: string, cwd?: string): string[] {
  const output = exec(
    'git',
    ['show', '--no-patch', '--format=%s%n%b', '--end-of-options', commit],
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
