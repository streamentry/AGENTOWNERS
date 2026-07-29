import path from 'node:path';
import { hashPolicy, loadPolicyText, type AgentOwnersPolicy } from '@agent-owners/core';
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

export type PolicyEvidence = {
  policyDigest: string;
  policyRef: string;
};

export function buildPolicyEvidence(policy: AgentOwnersPolicy, policyRef: string): PolicyEvidence {
  return { policyDigest: hashPolicy(policy), policyRef };
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
