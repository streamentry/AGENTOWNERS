// Sticky comment management for AGENTOWNERS verdicts

import type { Octokit } from './github.js';

export const MARKER = '<!-- agentowners-verdict -->';

type CommentCandidate = {
  id: number;
  body?: string | null;
  user?: {
    login?: string | null;
    type?: string | null;
  } | null;
};

function isBotAuthored(comment: CommentCandidate): boolean {
  return comment.user?.type === 'Bot' || comment.user?.login?.endsWith('[bot]') === true;
}

export async function upsertVerdictComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  let page = 1;
  let existing: CommentCandidate | undefined;

  while (true) {
    const comments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      page,
    });

    existing = comments.data.find(
      (comment: CommentCandidate) => isBotAuthored(comment) && comment.body?.includes(MARKER),
    );
    if (existing || comments.data.length < 100) break;
    page++;
  }

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}
