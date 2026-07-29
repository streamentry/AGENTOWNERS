import { describe, expect, it, vi } from 'vitest';
import { parseReviewer, requestMissingReviewers } from '../src/reviewers.js';

describe('reviewer parsing', () => {
  it('accepts users and organization teams and rejects ambiguous values', () => {
    expect(parseReviewer('@Alice')).toEqual({ kind: 'user', login: 'alice' });
    expect(parseReviewer('@streamentry/security-review')).toEqual({
      kind: 'team',
      organization: 'streamentry',
      slug: 'security-review',
    });
    expect(parseReviewer('not a reviewer')).toBeNull();
    expect(parseReviewer('@org/team/extra')).toBeNull();
  });
});

describe('requestMissingReviewers', () => {
  it('requests only valid missing users and same-organization teams', async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          listRequestedReviewers: vi.fn().mockResolvedValue({
            data: { users: [{ login: 'already-requested' }], teams: [{ slug: 'existing-team' }] },
          }),
          requestReviewers: vi.fn().mockResolvedValue({ data: {} }),
        },
        users: {
          getByUsername: vi.fn().mockImplementation(async ({ username }: { username: string }) => {
            if (username === 'missing-user') throw new Error('not found');
            return { data: { login: username } };
          }),
        },
        teams: {
          getByName: vi.fn().mockResolvedValue({ data: { slug: 'security-review' } }),
        },
      },
    };

    await expect(
      requestMissingReviewers(
        mockOctokit as never,
        'streamentry',
        'AGENTOWNERS',
        12,
        'author',
        [
          '@author',
          '@new-reviewer',
          '@missing-user',
          '@streamentry/security-review',
          '@other-org/security-review',
          '@already-requested',
          'not valid',
        ],
      ),
    ).resolves.toEqual({ requestedUsers: ['new-reviewer'], requestedTeams: ['security-review'] });

    expect(mockOctokit.rest.users.getByUsername).toHaveBeenCalledWith({ username: 'new-reviewer' });
    expect(mockOctokit.rest.teams.getByName).toHaveBeenCalledWith({
      org: 'streamentry',
      team_slug: 'security-review',
    });
    expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
      owner: 'streamentry',
      repo: 'AGENTOWNERS',
      pull_number: 12,
      reviewers: ['new-reviewer'],
      team_reviewers: ['security-review'],
    });
  });

  it('does not make an idempotent request when every reviewer is already pending', async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          listRequestedReviewers: vi.fn().mockResolvedValue({
            data: { users: [{ login: 'reviewer' }], teams: [{ slug: 'security' }] },
          }),
          requestReviewers: vi.fn(),
        },
        users: { getByUsername: vi.fn() },
        teams: { getByName: vi.fn() },
      },
    };

    await requestMissingReviewers(
      mockOctokit as never,
      'streamentry',
      'AGENTOWNERS',
      12,
      'author',
      ['@reviewer', '@streamentry/security'],
    );

    expect(mockOctokit.rest.users.getByUsername).not.toHaveBeenCalled();
    expect(mockOctokit.rest.teams.getByName).not.toHaveBeenCalled();
    expect(mockOctokit.rest.pulls.requestReviewers).not.toHaveBeenCalled();
  });
});
