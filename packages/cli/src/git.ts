// Git helper functions using child_process.execFileSync.
// Refs are passed as argv, never interpreted by a shell.

import { execFileSync } from 'child_process';

function exec(cmd: string, args: string[], cwd?: string): string {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function execBytes(cmd: string, args: string[], cwd?: string): Buffer {
  return execFileSync(cmd, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function decodeGitPath(bytes: Buffer): string {
  const filePath = bytes.toString('utf8');
  if (!Buffer.from(filePath, 'utf8').equals(bytes)) {
    throw new Error('Git pathname is not valid UTF-8.');
  }
  return filePath;
}

function parseNulDelimitedPaths(output: Buffer): string[] {
  if (output.length === 0) return [];
  if (output.at(-1) !== 0) {
    throw new Error('Git pathname output is not NUL-terminated.');
  }

  const paths: string[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    if (index === start) throw new Error('Git pathname output contains an empty record.');
    paths.push(decodeGitPath(output.subarray(start, index)));
    start = index + 1;
  }
  return paths;
}

export function getChangedFiles(base: string, head: string, cwd?: string): string[] {
  const output = execBytes(
    'git',
    ['diff', '--name-only', '-z', '--end-of-options', base, head, '--'],
    cwd,
  );
  return parseNulDelimitedPaths(output);
}

export function getCommitMessages(base: string, head: string, cwd?: string): string[] {
  const output = exec(
    'git',
    ['log', '--format=%s%n%b', '--end-of-options', `${base}..${head}`],
    cwd,
  ).trim();
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

export function getCurrentActor(cwd?: string): string | null {
  try {
    const name = exec('git', ['config', 'user.name'], cwd).trim();
    return name || null;
  } catch {
    return null;
  }
}
