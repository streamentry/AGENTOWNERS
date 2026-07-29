import { describe, expect, it, vi } from 'vitest';
import {
  buildPolicyEvidence,
  loadTrustedPolicy,
  normalizeRepositoryPolicyPath,
  selectTrustedPolicyRef,
} from '../src/policy.js';
import { hashPolicy } from '@agent-owners/core';

const evidencePolicy = { version: 1 as const, defaults: { unknown_agent: 'block' as const } };

describe('selectTrustedPolicyRef', () => {
  it('uses the immutable base SHA for pull request events', () => {
    expect(selectTrustedPolicyRef('pull_request', 'base-sha', 'main')).toBe('base-sha');
    expect(selectTrustedPolicyRef('pull_request_review', 'review-base-sha', 'main')).toBe(
      'review-base-sha',
    );
  });

  it('uses the default branch for non-pull-request events', () => {
    expect(selectTrustedPolicyRef('issues', undefined, 'main')).toBe('main');
    expect(selectTrustedPolicyRef('issue_comment', undefined, 'trunk')).toBe('trunk');
  });

  it('fails closed when the required trusted ref is absent', () => {
    expect(() => selectTrustedPolicyRef('pull_request', undefined, 'main')).toThrow(
      'Missing trusted repository ref',
    );
    expect(() => selectTrustedPolicyRef('issues', 'irrelevant-sha', undefined)).toThrow(
      'Missing trusted repository ref',
    );
  });
});

describe('buildPolicyEvidence', () => {
  it('binds the canonical policy digest to the trusted ref', () => {
    expect(buildPolicyEvidence(evidencePolicy, 'base-sha')).toEqual({
      policyDigest: hashPolicy(evidencePolicy),
      policyRef: 'base-sha',
    });
  });
});

describe('normalizeRepositoryPolicyPath', () => {
  it('accepts a repository-relative policy path', () => {
    expect(normalizeRepositoryPolicyPath('.github/AGENTOWNERS.yml')).toBe(
      '.github/AGENTOWNERS.yml',
    );
  });

  it.each(['/tmp/policy.yml', '../policy.yml', '.github/../../policy.yml'])(
    'rejects paths outside the trusted repository tree: %s',
    (policyPath) => {
      expect(() => normalizeRepositoryPolicyPath(policyPath)).toThrow(
        /repository-relative policy path/i,
      );
    },
  );
});

describe('loadTrustedPolicy', () => {
  it('loads policy content from the immutable base revision', async () => {
    const getContent = vi.fn().mockResolvedValue({
      data: {
        type: 'file',
        encoding: 'base64',
        content: Buffer.from('version: 1\ndefaults:\n  unknown_agent: block\n').toString('base64'),
      },
    });
    const octokit = { rest: { repos: { getContent } } };

    await expect(
      loadTrustedPolicy(
        octokit as never,
        'streamentry',
        'AGENTOWNERS',
        '.github/AGENTOWNERS.yml',
        '0123456789abcdef0123456789abcdef01234567',
      ),
    ).resolves.toMatchObject({
      version: 1,
      defaults: { unknown_agent: 'block' },
    });
    expect(getContent).toHaveBeenCalledWith({
      owner: 'streamentry',
      repo: 'AGENTOWNERS',
      path: '.github/AGENTOWNERS.yml',
      ref: '0123456789abcdef0123456789abcdef01234567',
    });
  });

  it('fails closed when GitHub returns a directory or unsupported encoding', async () => {
    const getContent = vi.fn().mockResolvedValue({ data: [] });
    const octokit = { rest: { repos: { getContent } } };

    await expect(
      loadTrustedPolicy(octokit as never, 'owner', 'repo', 'AGENTOWNERS.yml', 'base-sha'),
    ).rejects.toThrow(/regular base-revision file/i);
  });
});
