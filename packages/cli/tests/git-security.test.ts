import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { getChangedFiles, getCommitMessages } from '../src/git.js';

const temporaryDirectories: string[] = [];

async function makeRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'agentowners-git-security-'));
  temporaryDirectories.push(directory);
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  execFileSync('git', ['commit', '--allow-empty', '--message', 'initial'], {
    cwd: directory,
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: 'security@example.test',
      GIT_AUTHOR_NAME: 'Security Test',
      GIT_COMMITTER_EMAIL: 'security@example.test',
      GIT_COMMITTER_NAME: 'Security Test',
    },
  });
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('git revision option boundaries', () => {
  it('does not let a diff revision write an arbitrary file through --output', async () => {
    const repository = await makeRepository();
    const target = join(repository, 'diff-output');

    expect(() => getChangedFiles(`--output=${target}`, 'HEAD', repository)).toThrow();
    expect(existsSync(target)).toBe(false);
  });

  it('does not let a log revision write an arbitrary file through --output', async () => {
    const repository = await makeRepository();
    const target = join(repository, 'log-output');

    expect(() => getCommitMessages(`--output=${target}`, 'HEAD', repository)).toThrow();
    expect(existsSync(`${target}..HEAD`)).toBe(false);
  });
});
