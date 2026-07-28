import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import {
  getChangedFiles,
  getCommitEmails,
  getCommitMessages,
  getCommitNames,
  getCurrentActor,
} from '../src/git.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('git helpers', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes refs as argv without invoking a shell', () => {
    vi.mocked(execFileSync).mockReturnValue('src/index.ts\nREADME.md\n');

    const files = getChangedFiles('main; touch /tmp/pwned', 'HEAD', '/repo');

    expect(files).toEqual(['src/index.ts', 'README.md']);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', '--end-of-options', 'main; touch /tmp/pwned', 'HEAD', '--'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('reads commit messages from the requested range', () => {
    vi.mocked(execFileSync).mockReturnValue('feat: safe change\nbody\n');

    expect(getCommitMessages('main', 'HEAD')).toEqual(['feat: safe change', 'body']);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['log', '--format=%s%n%b', '--end-of-options', 'main..HEAD'],
      expect.any(Object),
    );
  });

  it('reads commit authors from the requested range', () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce('bot@example.test\n')
      .mockReturnValueOnce('Automation Bot\n');

    expect(getCommitEmails('main', 'HEAD')).toEqual(['bot@example.test']);
    expect(getCommitNames('main', 'HEAD')).toEqual(['Automation Bot']);
    expect(execFileSync).toHaveBeenNthCalledWith(
      1,
      'git',
      ['log', '--format=%ae', '--end-of-options', 'main..HEAD'],
      expect.any(Object),
    );
    expect(execFileSync).toHaveBeenNthCalledWith(
      2,
      'git',
      ['log', '--format=%an', '--end-of-options', 'main..HEAD'],
      expect.any(Object),
    );
  });

  it('returns null when the git identity is unavailable', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not configured');
    });

    expect(getCurrentActor()).toBeNull();
  });
});
