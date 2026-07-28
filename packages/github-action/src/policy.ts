import path from 'node:path';
import { loadPolicyText, type AgentOwnersPolicy } from '@agent-owners/core';
import { getRepositoryFileContent, type Octokit } from './github.js';

export function selectTrustedPolicyRef(
  eventName: string,
  pullRequestBaseSha: string | undefined,
  defaultBranch: string | undefined,
): string {
  const isPullRequestEvent =
    eventName === 'pull_request' || eventName === 'pull_request_review';
  const ref = isPullRequestEvent ? pullRequestBaseSha : defaultBranch;
  if (!ref) throw new Error('Missing trusted repository ref for policy load.');
  return ref;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Return the base revision captured by the webhook event, not a later PR API
 * response that may observe a force-push after the event was delivered.
 */
export function extractPullRequestBaseSha(payload: unknown): string {
  const pullRequest = asRecord(asRecord(payload)?.pull_request);
  const base = asRecord(pullRequest?.base);
  const sha = base?.sha;
  if (typeof sha !== 'string' || sha.trim() === '') {
    throw new Error('Missing pull_request.base.sha in trusted webhook payload.');
  }
  return sha.trim();
}

export function normalizeRepositoryPolicyPath(policyPath: string): string {
  if (path.posix.isAbsolute(policyPath) || path.win32.isAbsolute(policyPath)) {
    throw new Error('Policy path must be a repository-relative policy path.');
  }

  const normalized = path.posix.normalize(policyPath.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized === '.') {
    throw new Error('Policy path must be a repository-relative policy path.');
  }
  return normalized;
}

export async function loadTrustedPolicy(
  octokit: Octokit,
  owner: string,
  repo: string,
  policyPath: string,
  ref: string,
): Promise<AgentOwnersPolicy> {
  if (!ref) throw new Error('Missing trusted repository ref for policy load.');
  const repositoryPath = normalizeRepositoryPolicyPath(policyPath);
  const policyText = await getRepositoryFileContent(octokit, owner, repo, repositoryPath, ref);
  return loadPolicyText(policyText, `${repositoryPath} at trusted ref ${ref}`);
}
