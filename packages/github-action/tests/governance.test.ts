import { describe, expect, it, vi } from 'vitest';
import {
  parseReviewerTargets,
  requestDecisionReviewers,
  shouldRequestReviewers,
  syncDecisionLabels,
} from '../src/governance.js';

function createOctokit() {
  return {
    rest: {
      pulls: {
        listRequestedReviewers: vi.fn(),
        requestReviewers: vi.fn(),
      },
      issues: {
        getLabel: vi.fn(),
        createLabel: vi.fn(),
        addLabels: vi.fn(),
        removeLabel: vi.fn(),
      },
    },
  };
}

describe('parseReviewerTargets', () => {
  it('normalizes users and same-organization teams while excluding the author', () => {
    expect(
      parseReviewerTargets(
        ['@Alice', 'alice', '@streamentry/security', '@Author'],
        'streamentry',
        'author',
      ),
    ).toEqual({
      reviewers: ['alice'],
      teamReviewers: ['security'],
    });
  });

  it('rejects teams outside the repository organization', () => {
    expect(() => parseReviewerTargets(['@other-org/security'], 'streamentry', 'author')).toThrow(
      'Reviewer team must belong to @streamentry',
    );
  });

  it.each(['', '@', 'name with spaces', '@org/team/extra'])(
    'rejects invalid reviewer reference %j',
    (reviewer) => {
      expect(() => parseReviewerTargets([reviewer], 'streamentry', 'author')).toThrow(
        'Invalid reviewer reference',
      );
    },
  );
});

describe('requestDecisionReviewers', () => {
  it('requests only reviewers that are not already pending', async () => {
    const octokit = createOctokit();
    octokit.rest.pulls.listRequestedReviewers.mockResolvedValue({
      data: {
        users: [{ login: 'alice' }],
        teams: [{ slug: 'security' }],
      },
    });
    octokit.rest.pulls.requestReviewers.mockResolvedValue({ data: {} });

    const result = await requestDecisionReviewers(
      octokit as never,
      'streamentry',
      'AGENTOWNERS',
      18,
      ['@Alice', '@Bob', '@streamentry/security', '@streamentry/core'],
      'author',
    );

    expect(result).toEqual({
      reviewers: ['bob'],
      teamReviewers: ['core'],
    });
    expect(octokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
      owner: 'streamentry',
      repo: 'AGENTOWNERS',
      pull_number: 18,
      reviewers: ['bob'],
      team_reviewers: ['core'],
    });
  });

  it('does not write when every reviewer is already pending', async () => {
    const octokit = createOctokit();
    octokit.rest.pulls.listRequestedReviewers.mockResolvedValue({
      data: {
        users: [{ login: 'alice' }],
        teams: [],
      },
    });

    const result = await requestDecisionReviewers(
      octokit as never,
      'streamentry',
      'AGENTOWNERS',
      18,
      ['@alice'],
      'author',
    );

    expect(result).toEqual({ reviewers: [], teamReviewers: [] });
    expect(octokit.rest.pulls.requestReviewers).not.toHaveBeenCalled();
  });
});

describe('shouldRequestReviewers', () => {
  it('allows only non-dry-run pull-request decisions with configured reviewers', () => {
    expect(shouldRequestReviewers('pull_request', false, 18, 1)).toBe(true);
    expect(shouldRequestReviewers('pull_request', true, 18, 1)).toBe(false);
    expect(shouldRequestReviewers('issues', false, 18, 1)).toBe(false);
    expect(shouldRequestReviewers('pull_request', false, undefined, 1)).toBe(false);
    expect(shouldRequestReviewers('pull_request', false, 18, 0)).toBe(false);
  });
});

describe('syncDecisionLabels', () => {
  it('replaces stale reserved risk labels and preserves unrelated labels', async () => {
    const octokit = createOctokit();
    octokit.rest.issues.getLabel.mockResolvedValue({ data: {} });
    octokit.rest.issues.removeLabel.mockResolvedValue({ data: [] });
    octokit.rest.issues.addLabels.mockResolvedValue({ data: [] });

    await syncDecisionLabels(
      octokit as never,
      'streamentry',
      'AGENTOWNERS',
      18,
      ['risk-low', 'bug', 'needs-human-review'],
      ['ai-agent', 'risk-high', 'needs-human-review'],
    );

    expect(octokit.rest.issues.removeLabel).toHaveBeenCalledTimes(1);
    expect(octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
      owner: 'streamentry',
      repo: 'AGENTOWNERS',
      issue_number: 18,
      name: 'risk-low',
    });
    expect(octokit.rest.issues.removeLabel).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bug' }),
    );
    expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: 'streamentry',
      repo: 'AGENTOWNERS',
      issue_number: 18,
      labels: ['ai-agent', 'needs-human-review', 'risk-high'],
    });
  });

  it('creates a missing decision label before applying it', async () => {
    const octokit = createOctokit();
    octokit.rest.issues.getLabel.mockRejectedValue({ status: 404 });
    octokit.rest.issues.createLabel.mockResolvedValue({ data: {} });
    octokit.rest.issues.addLabels.mockResolvedValue({ data: [] });

    await syncDecisionLabels(
      octokit as never,
      'streamentry',
      'AGENTOWNERS',
      18,
      [],
      ['risk-critical'],
    );

    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith({
      owner: 'streamentry',
      repo: 'AGENTOWNERS',
      name: 'risk-critical',
      color: 'd73a4a',
    });
  });

  it('tolerates a concurrent label creation only after confirming the label exists', async () => {
    const octokit = createOctokit();
    octokit.rest.issues.getLabel
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ data: {} });
    octokit.rest.issues.createLabel.mockRejectedValue({ status: 422 });
    octokit.rest.issues.addLabels.mockResolvedValue({ data: [] });

    await expect(
      syncDecisionLabels(octokit as never, 'streamentry', 'AGENTOWNERS', 18, [], ['risk-low']),
    ).resolves.toBeUndefined();
    expect(octokit.rest.issues.getLabel).toHaveBeenCalledTimes(2);
  });

  it('removes stale risk labels when the next decision has no labels', async () => {
    const octokit = createOctokit();
    octokit.rest.issues.removeLabel.mockResolvedValue({ data: [] });

    await syncDecisionLabels(
      octokit as never,
      'streamentry',
      'AGENTOWNERS',
      18,
      ['risk-medium'],
      [],
    );

    expect(octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
      owner: 'streamentry',
      repo: 'AGENTOWNERS',
      issue_number: 18,
      name: 'risk-medium',
    });
    expect(octokit.rest.issues.addLabels).not.toHaveBeenCalled();
  });

  it('tolerates a stale-label removal race but not other API failures', async () => {
    const octokit = createOctokit();
    octokit.rest.issues.removeLabel.mockRejectedValueOnce({ status: 404 });

    await expect(
      syncDecisionLabels(octokit as never, 'streamentry', 'AGENTOWNERS', 18, ['risk-medium'], []),
    ).resolves.toBeUndefined();

    octokit.rest.issues.removeLabel.mockRejectedValueOnce({ status: 403 });
    await expect(
      syncDecisionLabels(octokit as never, 'streamentry', 'AGENTOWNERS', 18, ['risk-medium'], []),
    ).rejects.toEqual({ status: 403 });
  });

  it('fails loud when label lookup fails for a reason other than absence', async () => {
    const octokit = createOctokit();
    octokit.rest.issues.getLabel.mockRejectedValue({ status: 403 });

    await expect(
      syncDecisionLabels(octokit as never, 'streamentry', 'AGENTOWNERS', 18, [], ['risk-high']),
    ).rejects.toEqual({ status: 403 });
    expect(octokit.rest.issues.createLabel).not.toHaveBeenCalled();
  });
});
