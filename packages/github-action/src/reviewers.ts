import type { Octokit } from './github.js';

export type ParsedReviewer =
  | { kind: 'user'; login: string }
  | { kind: 'team'; organization: string; slug: string };

export type ReviewerRequestResult = {
  requestedUsers: string[];
  requestedTeams: string[];
};

function normalize(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function parseReviewer(value: string): ParsedReviewer | null {
  const normalized = normalize(value);
  if (/^[a-z0-9-]+$/i.test(normalized)) {
    return { kind: 'user', login: normalized };
  }

  const teamMatch = normalized.match(/^([a-z0-9-]+)\/([a-z0-9-]+)$/i);
  if (teamMatch) {
    return { kind: 'team', organization: teamMatch[1], slug: teamMatch[2] };
  }

  return null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function existingUserLogins(data: { users?: Array<{ login?: string | null }> }): Set<string> {
  return new Set(
    (data.users ?? [])
      .map((user) => user.login)
      .filter((login): login is string => typeof login === 'string')
      .map(normalize),
  );
}

function existingTeamSlugs(data: {
  teams?: Array<{ slug?: string | null; name?: string | null }>;
}): Set<string> {
  return new Set(
    (data.teams ?? [])
      .flatMap((team) => [team.slug, team.name])
      .filter((value): value is string => typeof value === 'string')
      .map(normalize),
  );
}

async function resolveUsers(
  octokit: Octokit,
  users: Array<Extract<ParsedReviewer, { kind: 'user' }>>,
  existingUsers: Set<string>,
  author: string,
): Promise<string[]> {
  const resolved: string[] = [];
  for (const reviewer of users) {
    if (existingUsers.has(normalize(reviewer.login))) continue;
    try {
      const response = await octokit.rest.users.getByUsername({ username: reviewer.login });
      const login = response.data.login;
      if (typeof login === 'string' && normalize(login) !== normalize(author)) {
        resolved.push(login);
        existingUsers.add(normalize(login));
      }
    } catch {
      // Invalid or inaccessible users are not sent to requestReviewers.
    }
  }
  return resolved;
}

async function resolveTeams(
  octokit: Octokit,
  owner: string,
  teams: Array<Extract<ParsedReviewer, { kind: 'team' }>>,
  existingTeams: Set<string>,
): Promise<string[]> {
  const resolved: string[] = [];
  for (const reviewer of teams) {
    if (normalize(reviewer.organization) !== normalize(owner)) continue;
    if (existingTeams.has(normalize(reviewer.slug))) continue;
    try {
      const response = await octokit.rest.teams.getByName({
        org: owner,
        team_slug: reviewer.slug,
      });
      const slug = response.data.slug;
      if (typeof slug === 'string') {
        resolved.push(slug);
        existingTeams.add(normalize(slug));
      }
    } catch {
      // Foreign, missing, or inaccessible teams are never requested.
    }
  }
  return resolved;
}

export async function requestMissingReviewers(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  author: string,
  requiredReviewers: string[],
): Promise<ReviewerRequestResult> {
  const parsed = requiredReviewers
    .map(parseReviewer)
    .filter((reviewer): reviewer is ParsedReviewer => reviewer !== null);
  const users = parsed.filter(
    (reviewer): reviewer is Extract<ParsedReviewer, { kind: 'user' }> =>
      reviewer.kind === 'user' && normalize(reviewer.login) !== normalize(author),
  );
  const teams = parsed.filter(
    (reviewer): reviewer is Extract<ParsedReviewer, { kind: 'team' }> => reviewer.kind === 'team',
  );

  if (users.length === 0 && teams.length === 0) {
    return { requestedUsers: [], requestedTeams: [] };
  }

  const current = await octokit.rest.pulls.listRequestedReviewers({
    owner,
    repo,
    pull_number: pullNumber,
  });
  const existingUsers = existingUserLogins(current.data);
  const existingTeams = existingTeamSlugs(current.data);
  const requestedUsers = await resolveUsers(octokit, users, existingUsers, author);
  const requestedTeams = await resolveTeams(octokit, owner, teams, existingTeams);

  if (requestedUsers.length === 0 && requestedTeams.length === 0) {
    return { requestedUsers: [], requestedTeams: [] };
  }

  await octokit.rest.pulls.requestReviewers({
    owner,
    repo,
    pull_number: pullNumber,
    reviewers: unique(requestedUsers),
    team_reviewers: unique(requestedTeams),
  });

  return {
    requestedUsers: unique(requestedUsers),
    requestedTeams: unique(requestedTeams),
  };
}
