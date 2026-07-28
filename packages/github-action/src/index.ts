// @agent-owners/github-action — main action entrypoint

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  classifyFiles,
  detectSecretPatterns,
  inferActions,
  detectAgent,
  evaluatePolicy,
  renderVerdict,
  renderAuditJson,
} from '@agent-owners/core';
import type { GitHubEventType } from '@agent-owners/core';
import { getPRFiles, getPRMetadata, getIssueMetadata } from './github.js';
import { upsertVerdictComment } from './comment.js';
import { requireGitHubToken } from './config.js';
import { loadTrustedPolicy, selectTrustedPolicyRef } from './policy.js';

export const ACTION_MODES = ['comment', 'check', 'both', 'dry-run'] as const;
export type ActionMode = (typeof ACTION_MODES)[number];

export function normalizeActionMode(value: string): ActionMode {
  if ((ACTION_MODES as readonly string[]).includes(value)) {
    return value as ActionMode;
  }
  throw new Error('Mode must be one of: comment, check, both, dry-run.');
}

export async function run(): Promise<void> {
  try {
    // 1. Inputs
    const policyPath = core.getInput('policy-path') || '.github/AGENTOWNERS.yml';
    const mode = normalizeActionMode(core.getInput('mode') || 'comment');
    const failOnBlock = core.getInput('fail-on-block') !== 'false';
    const failOnRequireApproval = core.getInput('fail-on-require-approval') === 'true';
    const addLabels = core.getInput('add-labels') !== 'false';
    const knownAgentActorsRaw = core.getInput('known-agent-actors');
    const knownAgentActors = knownAgentActorsRaw
      ? knownAgentActorsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // 2. GitHub context
    const token = requireGitHubToken(process.env['GITHUB_TOKEN'], core.getInput('github-token'));
    const octokit = github.getOctokit(token);
    const ctx = github.context;
    const { owner, repo } = ctx.repo;

    core.info(`AGENTOWNERS check starting — event: ${ctx.eventName}`);
    core.info(`Policy: ${policyPath}`);
    core.info(`Mode: ${mode}`);

    const workspace = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
    let changedFiles: string[] = [];
    let diffContent = '';
    let patchesComplete = true;
    let pullRequestBaseSha: string | undefined;
    let actor = ctx.actor;
    let prTitle: string | undefined;
    let prBody: string | undefined;
    let issueTitle: string | undefined;
    let issueBody: string | undefined;
    let commentBody: string | undefined;
    let labels: string[] = [];
    let issueNumber: number | undefined;
    let eventType: GitHubEventType | undefined;
    let reviewState: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | undefined;

    const eventName = ctx.eventName;
    const payload = ctx.payload;

    if (eventName === 'pull_request') {
      const pr = payload.pull_request;
      if (!pr) throw new Error('Missing pull_request payload');
      issueNumber = pr.number as number;

      const prAction = payload.action as string;
      const validPrActions: GitHubEventType[] = [
        'pull_request.opened',
        'pull_request.synchronize',
        'pull_request.reopened',
        'pull_request.ready_for_review',
      ];
      const inferredEvent = `pull_request.${prAction}` as GitHubEventType;
      eventType = validPrActions.includes(inferredEvent) ? inferredEvent : 'pull_request.opened';

      const metadata = await getPRMetadata(octokit, owner, repo, issueNumber);
      const prFiles = await getPRFiles(octokit, owner, repo, issueNumber);
      changedFiles = prFiles.files;
      diffContent = prFiles.diffContent;
      patchesComplete = prFiles.patchesComplete;
      pullRequestBaseSha = metadata.baseSha;
      actor = metadata.actor || actor;
      prTitle = metadata.title;
      prBody = metadata.body;
      labels = metadata.labels;
    } else if (eventName === 'issues') {
      const issue = payload.issue;
      if (!issue) throw new Error('Missing issue payload');
      issueNumber = issue.number as number;

      const issueAction = payload.action as string;
      eventType = `issues.${issueAction}` as GitHubEventType;

      const metadata = await getIssueMetadata(octokit, owner, repo, issueNumber);
      actor = metadata.actor || actor;
      labels = metadata.labels;
      issueTitle = metadata.title;
      issueBody = metadata.body;
    } else if (eventName === 'issue_comment') {
      const issue = payload.issue;
      if (!issue) throw new Error('Missing issue payload for issue_comment');
      issueNumber = issue.number as number;

      const commentAction = payload.action as string;
      eventType = `issue_comment.${commentAction}` as GitHubEventType;

      const comment = payload.comment;
      actor = (comment?.user?.login as string) || actor;
      commentBody = (comment?.body as string | undefined) ?? undefined;
      labels = ((issue.labels ?? []) as Array<{ name: string }>).map((l) => l.name);

      const targetTitle = (issue.title as string | undefined) ?? undefined;
      const targetBody = (issue.body as string | undefined) ?? undefined;
      if (issue.pull_request) {
        prTitle = targetTitle;
        prBody = targetBody;
      } else {
        issueTitle = targetTitle;
        issueBody = targetBody;
      }
    } else if (eventName === 'pull_request_review') {
      const pr = payload.pull_request;
      if (!pr) throw new Error('Missing pull_request payload for review');
      issueNumber = pr.number as number;
      eventType = 'pull_request_review.submitted';

      const review = payload.review;
      reviewState = review?.state as 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | undefined;
      actor = (review?.user?.login as string) || actor;

      const metadata = await getPRMetadata(octokit, owner, repo, issueNumber);
      const prFiles = await getPRFiles(octokit, owner, repo, issueNumber);
      changedFiles = prFiles.files;
      diffContent = prFiles.diffContent;
      patchesComplete = prFiles.patchesComplete;
      pullRequestBaseSha = metadata.baseSha;
      prTitle = metadata.title;
      prBody = metadata.body;
      labels = metadata.labels;
    } else {
      core.warning(`Unsupported event: ${eventName}. Skipping AGENTOWNERS check.`);
      return;
    }

    const trustedPolicyRef = selectTrustedPolicyRef(
      eventName,
      pullRequestBaseSha,
      payload.repository?.default_branch,
    );

    const policy = await loadTrustedPolicy(
      octokit,
      owner,
      repo,
      policyPath,
      trustedPolicyRef,
    );

    if (!eventType) {
      core.warning('Could not determine event type. Skipping.');
      return;
    }

    // 5. Classify files
    if (!patchesComplete) {
      core.warning('Some pull request patches were unavailable; secret-content scanning was partial.');
    }

    const baseClassification = classifyFiles(changedFiles);
    const filesClassification = {
      ...baseClassification,
      secretFilesDetected:
        baseClassification.secretFilesDetected || detectSecretPatterns(diffContent).length > 0,
    };

    // 6. Infer actions
    const detectedActions = inferActions({
      eventType,
      changedFiles,
      filesClassification,
      reviewState,
    });

    // 7. Detect agent
    // Extend policy actors with known-agent-actors input
    const agentDetection = detectAgent({
      actor,
      prTitle,
      prBody,
      issueBody,
      commentBody,
      labels,
      policy,
    });

    // If the actor is in knownAgentActors and not already confirmed, mark as likely
    if (knownAgentActors.includes(actor) && agentDetection.confidence === 'unknown') {
      agentDetection.signals.push(`known-agent-actors input: ${actor}`);
      (agentDetection as { confidence: string }).confidence = 'likely';
    }

    // 8. Evaluate policy
    const decision = evaluatePolicy({
      policy,
      agentDetection,
      detectedActions,
      changedFiles,
      filesClassification,
      actor,
      prTitle,
      prBody,
      issueTitle,
      issueBody,
      labels,
    });

    // 9. Render verdict
    const verdictBody = renderVerdict(decision, { actor });

    core.info(
      `Decision: ${decision.effect} (risk: ${decision.riskLevel}, score: ${decision.riskScore})`,
    );

    // 10. Post/update sticky comment (if mode includes "comment")
    const isDryRun = mode === 'dry-run';
    const shouldComment = (mode === 'comment' || mode === 'both') && !isDryRun;
    if (shouldComment && issueNumber !== undefined) {
      await upsertVerdictComment(octokit, owner, repo, issueNumber, verdictBody);
      core.info('Verdict comment posted/updated.');
    }

    // 11. Apply labels
    if (addLabels && issueNumber !== undefined && !isDryRun && decision.labelsToApply.length > 0) {
      await applyLabels(octokit, owner, repo, issueNumber, decision.labelsToApply);
    }

    // 12. Set outputs
    core.setOutput('decision', decision.effect);
    core.setOutput('risk-score', String(decision.riskScore));
    core.setOutput('risk-level', decision.riskLevel);
    core.setOutput(
      'matched-rules',
      JSON.stringify(
        decision.matchedRules.map((r: import('@agent-owners/core').MatchedRule) => r.name),
      ),
    );

    // 13. Write audit artifact
    const auditRecord = renderAuditJson({
      actor,
      repository: `${owner}/${repo}`,
      event: eventName,
      agentDetection: {
        matchedAgent: agentDetection.agentName,
        confidence: agentDetection.confidence,
      },
      decision,
      changedFiles,
    });

    const artifactPath = path.join(workspace, 'agentowners-decision.json');
    await fs.writeFile(artifactPath, JSON.stringify(auditRecord, null, 2), 'utf8');
    core.info(`Audit artifact written to ${artifactPath}`);

    // 14. Fail if needed
    if (decision.effect === 'block' && failOnBlock) {
      core.setFailed('AGENTOWNERS: action blocked by policy.');
      return;
    }

    if (decision.effect === 'require_approval' && failOnRequireApproval) {
      core.setFailed('AGENTOWNERS: action requires approval.');
      return;
    }

    core.info('AGENTOWNERS check complete.');
  } catch (error: unknown) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

async function applyLabels(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
): Promise<void> {
  // Ensure labels exist before applying
  const labelColors: Record<string, string> = {
    'ai-agent': 'a2eeef',
    'risk-low': '0e8a16',
    'risk-medium': 'fbca04',
    'risk-high': 'e4e669',
    'risk-critical': 'd73a4a',
  };

  for (const label of labels) {
    try {
      await octokit.rest.issues.getLabel({ owner, repo, name: label });
    } catch {
      // Label does not exist — create it
      const color = labelColors[label] ?? 'ededed';
      try {
        await octokit.rest.issues.createLabel({ owner, repo, name: label, color });
      } catch {
        // Ignore creation errors (race condition, permissions, etc.)
      }
    }
  }

  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });
}

run();
