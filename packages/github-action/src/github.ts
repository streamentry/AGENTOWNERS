// GitHub API helpers using @actions/github Octokit

import type { getOctokit } from '@actions/github';

export type Octokit = ReturnType<typeof getOctokit>;

export type PRMetadata = {
  title: string;
  body: string;
  actor: string;
  labels: string[];
  draft: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  base: string;
  baseSha: string;
  head: string;
  commitEmails: string[];
  commitNames: string[];
};

export type PRFiles = {
  files: string[];
  diffContent: string;
  patchesComplete: boolean;
};

export type IssueMetadata = {
  title: string;
  body: string;
  actor: string;
  labels: string[];
  state: string;
};

export async function getRepositoryFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  filePath: string,
  ref: string,
): Promise<string> {
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: filePath,
    ref,
  });

  if (
    Array.isArray(data) ||
    data.type !== 'file' ||
    data.encoding !== 'base64' ||
    typeof data.content !== 'string'
  ) {
    throw new Error('Policy path must resolve to a regular base-revision file.');
  }

  return Buffer.from(data.content.replaceAll('\n', ''), 'base64').toString('utf8');
}

export async function getPRChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<string[]> {
  return (await getPRFiles(octokit, owner, repo, pullNumber)).files;
}

export async function getPRFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRFiles> {
  const files: string[] = [];
  const patches: string[] = [];
  let patchesComplete = true;
  let page = 1;

  while (true) {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
      page,
    });

    for (const file of response.data) {
      files.push(file.filename);
      if (typeof file.patch === 'string') {
        patches.push(file.patch);
      } else {
        patchesComplete = false;
      }
    }

    if (response.data.length < 100) {
      break;
    }
    page++;
  }

  return {
    files,
    diffContent: patches.join('\n'),
    patchesComplete,
  };
}

export async function getPRMetadata(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRMetadata> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });
  const commitAuthors = await getPRCommitAuthors(octokit, owner, repo, pullNumber);

  return {
    title: data.title,
    body: data.body ?? '',
    actor: data.user?.login ?? '',
    labels: data.labels.map((l: { name: string }) => l.name),
    draft: data.draft ?? false,
    commits: data.commits,
    additions: data.additions,
    deletions: data.deletions,
    changedFiles: data.changed_files,
    base: data.base.ref,
    baseSha: data.base.sha,
    head: data.head.ref,
    commitEmails: commitAuthors.emails,
    commitNames: commitAuthors.names,
  };
}

export async function getPRCommitAuthors(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ emails: string[]; names: string[] }> {
  const emails: string[] = [];
  const names: string[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
      page,
    });

    for (const commit of response.data) {
      const author = commit.commit?.author;
      if (typeof author?.email === 'string' && author.email) emails.push(author.email);
      if (typeof author?.name === 'string' && author.name) names.push(author.name);
    }

    if (response.data.length < 100) break;
    page += 1;
  }

  return { emails, names };
}

export async function getIssueMetadata(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueMetadata> {
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    title: data.title,
    body: data.body ?? '',
    actor: data.user?.login ?? '',
    labels: data.labels.map((l: string | { name?: string }) => (typeof l === 'string' ? l : l.name ?? '')),
    state: data.state,
  };
}
