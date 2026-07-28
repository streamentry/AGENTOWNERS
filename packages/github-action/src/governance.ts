import type { Octokit } from './github.js';

const USER_REVIEWER = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const TEAM_REVIEWER = /^[a-z\d](?:[a-z\d-]{0,98}[a-z\d])?$/i;
const MANAGED_RISK_LABELS = new Set(['risk-low', 'risk-medium', 'risk-high', 'risk-critical']);

const LABEL_COLORS: Readonly<Record<string, string>> = {
  'ai-agent': 'a2eeef',
  'risk-low': '0e8a16',
  'risk-medium': 'fbca04',
  'risk-high': 'e4e669',
  'risk-critical': 'd73a4a',
};

export type ReviewerTargets = {
  reviewers: string[];
  teamReviewers: string[];
};

export function shouldRequestReviewers(
  eventName: string,
  isDryRun: boolean,
  issueNumber: number | undefined,
  reviewerCount: number,
): boolean {
  return (
    eventName === 'pull_request' &&
    !isDryRun &&
    issueNumber !== undefined &&
    reviewerCount > 0
  );
}

export function parseReviewerTargets(
  references: string[],
  repositoryOwner: string,
  pullAuthor: string,
): ReviewerTargets {
  const reviewers = new Set<string>();
  const teamReviewers = new Set<string>();

  for (const reference of references) {
    const normalized = reference.startsWith('@') ? reference.slice(1) : reference;
    const parts = normalized.split('/');
    if (parts.length === 2) {
      addTeamReviewer(parts, repositoryOwner, reference, teamReviewers);
    } else if (parts.length === 1 && USER_REVIEWER.test(normalized)) {
      if (normalized.toLowerCase() !== pullAuthor.toLowerCase()) {
        reviewers.add(normalized.toLowerCase());
      }
    } else {
      throw new Error(`Invalid reviewer reference: ${reference}`);
    }
  }

  return {
    reviewers: [...reviewers].sort(),
    teamReviewers: [...teamReviewers].sort(),
  };
}

function addTeamReviewer(
  parts: string[],
  repositoryOwner: string,
  reference: string,
  target: Set<string>,
): void {
  const [organization = '', team = ''] = parts;
  if (organization.toLowerCase() !== repositoryOwner.toLowerCase()) {
    throw new Error(`Reviewer team must belong to @${repositoryOwner}: ${reference}`);
  }
  if (!TEAM_REVIEWER.test(team)) {
    throw new Error(`Invalid reviewer reference: ${reference}`);
  }
  target.add(team.toLowerCase());
}

export async function requestDecisionReviewers(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  requiredReviewers: string[],
  pullAuthor: string,
): Promise<ReviewerTargets> {
  const targets = parseReviewerTargets(requiredReviewers, owner, pullAuthor);
  if (targets.reviewers.length === 0 && targets.teamReviewers.length === 0) return targets;

  const response = await octokit.rest.pulls.listRequestedReviewers({
    owner,
    repo,
    pull_number: pullNumber,
  });
  const requestedUsers = new Set(response.data.users.map((user) => user.login.toLowerCase()));
  const requestedTeams = new Set(response.data.teams.map((team) => team.slug.toLowerCase()));
  const missing = {
    reviewers: targets.reviewers.filter((reviewer) => !requestedUsers.has(reviewer)),
    teamReviewers: targets.teamReviewers.filter((team) => !requestedTeams.has(team)),
  };

  if (missing.reviewers.length > 0 || missing.teamReviewers.length > 0) {
    await octokit.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pullNumber,
      reviewers: missing.reviewers,
      team_reviewers: missing.teamReviewers,
    });
  }
  return missing;
}

export async function syncDecisionLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  currentLabels: string[],
  desiredLabels: string[],
): Promise<void> {
  const desired = [...new Set(desiredLabels)].sort();
  const stale = currentLabels
    .filter((label) => MANAGED_RISK_LABELS.has(label) && !desired.includes(label))
    .sort();

  for (const label of stale) {
    await removeLabelIfPresent(octokit, owner, repo, issueNumber, label);
  }
  for (const label of desired) {
    await ensureLabel(octokit, owner, repo, label);
  }
  if (desired.length > 0) {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: desired,
    });
  }
}

async function ensureLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  name: string,
): Promise<void> {
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name });
  } catch (error: unknown) {
    if (!hasStatus(error, 404)) throw error;
    await createLabel(octokit, owner, repo, name);
  }
}

async function createLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  name: string,
): Promise<void> {
  try {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name,
      color: LABEL_COLORS[name] ?? 'ededed',
    });
  } catch (error: unknown) {
    if (!hasStatus(error, 422)) throw error;
    await octokit.rest.issues.getLabel({ owner, repo, name });
  }
}

async function removeLabelIfPresent(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string,
): Promise<void> {
  try {
    await octokit.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name });
  } catch (error: unknown) {
    if (!hasStatus(error, 404)) throw error;
  }
}

function hasStatus(error: unknown, status: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === status
  );
}
