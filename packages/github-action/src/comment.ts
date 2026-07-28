// Sticky comment management for AGENTOWNERS verdicts

import type { Octokit } from './github.js';

export const MARKER = '<!-- agentowners-verdict -->';
export const MARKER_CLOSE = '<!-- /agentowners-verdict -->';

function isVerdictComment(body: string | null | undefined): boolean {
  return body?.startsWith(`${MARKER}\n`) === true && body.includes(`\n${MARKER_CLOSE}`);
}

export async function upsertVerdictComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  let page = 1;
  let existing: { id: number; body?: string | null } | undefined;

  while (!existing) {
    const comments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      page,
    });
    existing = comments.data.find((c: { id: number; body?: string | null }) =>
      isVerdictComment(c.body),
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
