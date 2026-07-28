import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyFiles } from '@agent-owners/core';
import { getChangedFiles, getCommitMessages } from '../src/git.js';

const temporaryDirectories: string[] = [];

function isolatedGitEnvironment(): NodeJS.ProcessEnv {
  const environment = {
    ...process.env,
    GIT_AUTHOR_EMAIL: 'security@example.test',
    GIT_AUTHOR_NAME: 'Security Test',
    GIT_COMMITTER_EMAIL: 'security@example.test',
    GIT_COMMITTER_NAME: 'Security Test',
  };
  // Git hooks export repository-local variables that would redirect fixture
  // commands back into the repository under test despite an explicit cwd.
  for (const name of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ]) {
    delete environment[name];
  }
  return environment;
}

async function makeRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'agentowners-git-security-'));
  temporaryDirectories.push(directory);
  const env = isolatedGitEnvironment();
  execFileSync('git', ['init', '--quiet'], { cwd: directory, env });
  execFileSync('git', ['commit', '--allow-empty', '--message', 'initial'], {
    cwd: directory,
    env,
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

describe('git pathname boundaries', () => {
  it('preserves an adversarial workflow path for production classification', async () => {
    const repository = await makeRepository();
    const workflowDirectory = join(repository, '.github', 'workflows');
    const workflowPath = '.github/workflows/stealth\n.yml';
    const env = isolatedGitEnvironment();
    await mkdir(workflowDirectory, { recursive: true });
    await writeFile(join(repository, workflowPath), 'name: adversarial path\n');
    execFileSync('git', ['add', '--', workflowPath], { cwd: repository, env });
    execFileSync('git', ['commit', '--message', 'add adversarial workflow path'], {
      cwd: repository,
      env,
    });

    const changedFiles = getChangedFiles('HEAD~1', 'HEAD', repository);

    expect(changedFiles).toEqual([workflowPath]);
    expect(classifyFiles(changedFiles).changesWorkflows).toBe(true);
  });
});
