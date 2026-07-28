// Sticky comment management for AGENTOWNERS verdicts

import type { Octokit } from './github.js';

export const MARKER = '<!-- agentowners-verdict -->';
export const MARKER_CLOSE = '<!-- /agentowners-verdict -->';

type CommentRecord = {
  id: number;
  body?: string | null;
  user?: { login?: string | null } | null;
};

function isVerdictComment(comment: CommentRecord, trustedAuthor: string): boolean {
  return (
    comment.user?.login?.toLowerCase() === trustedAuthor.toLowerCase() &&
    comment.body?.startsWith(`${MARKER}\n`) === true &&
    comment.body.includes(`\n${MARKER_CLOSE}`)
  );
}

export async function upsertVerdictComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  trustedAuthor: string,
): Promise<void> {
  let page = 1;
  let existing: CommentRecord | undefined;

  while (!existing) {
    const comments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      page,
    });
    existing = comments.data.find((comment: CommentRecord) =>
      isVerdictComment(comment, trustedAuthor),
    );
    if (existing || comments.data.length < 100) break;
    page += 1;
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
