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

const MAX_PULL_REQUEST_FILES = 3000;
const FILES_PER_PAGE = 100;

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
  expectedFileCount?: number,
): Promise<PRFiles> {
  if (
    expectedFileCount !== undefined &&
    (!Number.isSafeInteger(expectedFileCount) || expectedFileCount < 0)
  ) {
    throw new Error('Pull request changed-file count must be a non-negative safe integer.');
  }
  if (expectedFileCount !== undefined && expectedFileCount > MAX_PULL_REQUEST_FILES) {
    throw new Error(
      `Pull request reports ${expectedFileCount} changed files, exceeding GitHub's 3,000-file API limit.`,
    );
  }
  if (expectedFileCount === 0) {
    return { files: [], diffContent: '', patchesComplete: true };
  }

  const files = new Set<string>();
  const patches: string[] = [];
  let patchesComplete = true;
  let listedFileCount = 0;
  let page = 1;

  while (true) {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: FILES_PER_PAGE,
      page,
    });
    listedFileCount += response.data.length;
    if (expectedFileCount !== undefined && listedFileCount > expectedFileCount) {
      throw new Error(
        `Pull request reported ${expectedFileCount} files but returned more than that count.`,
      );
    }

    for (const file of response.data) {
      files.add(file.filename);
      if (
        file.status === 'renamed' &&
        typeof file.previous_filename === 'string' &&
        file.previous_filename.length > 0 &&
        file.previous_filename !== file.filename
      ) {
        files.add(file.previous_filename);
      }
      if (typeof file.patch === 'string') {
        patches.push(file.patch);
      } else {
        patchesComplete = false;
      }
    }

    if (expectedFileCount !== undefined && listedFileCount === expectedFileCount) {
      break;
    }
    if (response.data.length < FILES_PER_PAGE) break;
    if (listedFileCount >= MAX_PULL_REQUEST_FILES) {
      throw new Error(
        "Pull request file enumeration reached GitHub's ambiguous 3,000-file API limit.",
      );
    }
    page++;
  }

  if (expectedFileCount !== undefined && listedFileCount !== expectedFileCount) {
    throw new Error(
      `Pull request reported ${expectedFileCount} files but returned ${listedFileCount}.`,
    );
  }

  return {
    files: [...files],
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
  };
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
