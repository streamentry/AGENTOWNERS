import type { AgentAction, GitHubEventType } from './types.js';
import { classifyFiles, type FilesClassification } from './classifier.js';

export type { GitHubEventType } from './types.js';

type LocalFilesClassification = {
  docsOnly?: boolean;
  hasTests?: boolean;
  hasDependencies?: boolean;
  hasWorkflows?: boolean;
  hasAuth?: boolean;
  hasInfra?: boolean;
  hasSecrets?: boolean;
};

export type ActionInferenceInput = {
  eventType: GitHubEventType;
  changedFiles?: string[];
  diffContent?: string;
  reviewState?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  filesClassification?: LocalFilesClassification | FilesClassification;
};

function hasClassifiedTests(classification: Record<string, unknown>): boolean {
  if (typeof classification['hasTests'] === 'boolean') {
    return classification['hasTests'];
  }

  const files = classification['files'];
  if (typeof files === 'object' && files !== null && !Array.isArray(files)) {
    return Object.values(files).some(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>)['isTests'] === true,
    );
  }

  return classification['testsOnly'] === true;
}

function normalizeClassification(
  input: LocalFilesClassification | FilesClassification,
): LocalFilesClassification {
  const classification = input as Record<string, unknown>;
  return {
    docsOnly: classification['docsOnly'] as boolean | undefined,
    hasTests: hasClassifiedTests(classification),
    hasDependencies:
      (classification['hasDependencies'] as boolean | undefined) ??
      (classification['changesDependencies'] as boolean | undefined),
    hasWorkflows:
      (classification['hasWorkflows'] as boolean | undefined) ??
      (classification['changesWorkflows'] as boolean | undefined),
    hasAuth:
      (classification['hasAuth'] as boolean | undefined) ??
      (classification['changesAuth'] as boolean | undefined),
    hasInfra:
      (classification['hasInfra'] as boolean | undefined) ??
      (classification['changesInfra'] as boolean | undefined),
    hasSecrets:
      (classification['hasSecrets'] as boolean | undefined) ??
      (classification['secretFilesDetected'] as boolean | undefined),
  };
}

export function inferFileBasedActions(
  classification: LocalFilesClassification | FilesClassification,
): AgentAction[] {
  const normalized = normalizeClassification(classification);
  const actions: AgentAction[] = [];
  if (normalized.docsOnly) actions.push('modify_docs');
  if (normalized.hasTests) actions.push('modify_tests');
  if (normalized.hasDependencies) actions.push('modify_dependencies');
  if (normalized.hasWorkflows) actions.push('edit_workflows');
  if (normalized.hasAuth) actions.push('modify_auth');
  if (normalized.hasInfra) actions.push('modify_infra');
  if (normalized.hasSecrets) actions.push('touch_secrets');
  return actions;
}

export function inferActions(input: ActionInferenceInput): AgentAction[] {
  const { eventType, changedFiles, reviewState, filesClassification } = input;
  const actions = new Set<AgentAction>();

  const classification = filesClassification
    ? normalizeClassification(filesClassification)
    : changedFiles
      ? normalizeClassification(classifyFiles(changedFiles))
      : {};

  switch (eventType) {
    case 'pull_request.opened':
    case 'pull_request.reopened':
    case 'pull_request.ready_for_review': {
      actions.add('open_pr');
      for (const a of inferFileBasedActions(classification)) actions.add(a);
      break;
    }
    case 'pull_request.synchronize': {
      actions.add('update_pr');
      for (const a of inferFileBasedActions(classification)) actions.add(a);
      break;
    }
    case 'issue_comment.created':
    case 'issue_comment.edited': {
      actions.add('comment');
      break;
    }
    case 'pull_request_review.submitted': {
      actions.add('review_comment');
      if (reviewState === 'APPROVED') actions.add('approve_pr');
      if (reviewState === 'CHANGES_REQUESTED') actions.add('request_changes');
      break;
    }
    case 'issues.labeled': {
      actions.add('label_issue');
      break;
    }
    case 'issues.closed': {
      actions.add('close_issue');
      break;
    }
    case 'issues.reopened': {
      actions.add('reopen_issue');
      break;
    }
    case 'issues.opened': {
      break;
    }
  }

  return Array.from(actions);
}
