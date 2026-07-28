import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { getChangedFiles, getCommitMessages, getCurrentActor } from '../src/git.js';

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
      ['diff', '--name-only', 'main; touch /tmp/pwned', 'HEAD'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('reads commit messages from the requested range', () => {
    vi.mocked(execFileSync).mockReturnValue('feat: safe change\nbody\n');

    expect(getCommitMessages('main', 'HEAD')).toEqual(['feat: safe change', 'body']);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['log', 'main..HEAD', '--format=%s%n%b'],
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
