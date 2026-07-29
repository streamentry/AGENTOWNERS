import { describe, expect, it } from 'vitest';
import { parseActionMode, requireGitHubToken } from '../src/config.js';

describe('parseActionMode', () => {
  it.each(['comment', 'check', 'both', 'dry-run'] as const)('accepts %s', (mode) => {
    expect(parseActionMode(mode)).toBe(mode);
  });

  it('defaults an empty input to comment mode', () => {
    expect(parseActionMode('')).toBe('comment');
  });

  it('rejects unsupported modes before any side effect', () => {
    expect(() => parseActionMode('enforce')).toThrow(
      'Invalid mode. Expected one of: comment, check, both, dry-run.',
    );
  });
});

describe('requireGitHubToken', () => {
  it('still fails closed when no token is configured', () => {
    expect(() => requireGitHubToken(undefined, '')).toThrow('Missing github-token input');
  });
});
