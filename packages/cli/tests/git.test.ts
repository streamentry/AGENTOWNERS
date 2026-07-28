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
    vi.mocked(execFileSync).mockReturnValue(Buffer.from('src/index.ts\0README.md\0'));

    const files = getChangedFiles('main; touch /tmp/pwned', 'HEAD', '/repo');

    expect(files).toEqual(['src/index.ts', 'README.md']);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', '-z', '--end-of-options', 'main; touch /tmp/pwned', 'HEAD', '--'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('preserves newlines inside NUL-delimited paths', () => {
    vi.mocked(execFileSync).mockReturnValue(
      Buffer.from('.github/workflows/stealth\n.yml\0src/index.ts\0'),
    );

    expect(getChangedFiles('main', 'HEAD')).toEqual([
      '.github/workflows/stealth\n.yml',
      'src/index.ts',
    ]);
  });

  it('returns no changed files for empty Git output', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.alloc(0));

    expect(getChangedFiles('main', 'HEAD')).toEqual([]);
  });

  it('fails closed for a path that is not valid UTF-8', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from([0xff, 0x00]));

    expect(() => getChangedFiles('main', 'HEAD')).toThrow('valid UTF-8');
  });

  it('fails closed when Git path output lacks its NUL terminator', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from('src/index.ts'));

    expect(() => getChangedFiles('main', 'HEAD')).toThrow('NUL-terminated');
  });

  it('fails closed when Git path output contains an empty record', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from('src/index.ts\0\0'));

    expect(() => getChangedFiles('main', 'HEAD')).toThrow('empty record');
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

  it('returns null when the git identity is unavailable', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not configured');
    });

    expect(getCurrentActor()).toBeNull();
  });
});
