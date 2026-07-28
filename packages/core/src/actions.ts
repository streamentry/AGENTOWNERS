import type { AgentAction, GitHubEventType } from './types.js';
import { classifyFiles, detectSecretPatterns, type FilesClassification } from './classifier.js';

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

function toLocalClassification(classification: FilesClassification): LocalFilesClassification {
  return {
    docsOnly: classification.docsOnly,
    hasTests: Object.values(classification.files).some((file) => file.isTests),
    hasDependencies: classification.changesDependencies,
    hasWorkflows: classification.changesWorkflows,
    hasAuth: classification.changesAuth,
    hasInfra: classification.changesInfra,
    hasSecrets: classification.secretFilesDetected,
  };
}

export function inferFileBasedActions(classification: LocalFilesClassification): AgentAction[] {
  const actions: AgentAction[] = [];
  if (classification.docsOnly) actions.push('modify_docs');
  if (classification.hasTests) actions.push('modify_tests');
  if (classification.hasDependencies) actions.push('modify_dependencies');
  if (classification.hasWorkflows) actions.push('edit_workflows');
  if (classification.hasAuth) actions.push('modify_auth');
  if (classification.hasInfra) actions.push('modify_infra');
  if (classification.hasSecrets) actions.push('touch_secrets');
  return actions;
}

export function inferActions(input: ActionInferenceInput): AgentAction[] {
  const { eventType, changedFiles, diffContent, reviewState, filesClassification } = input;
  const actions = new Set<AgentAction>();

  const fc = filesClassification as Record<string, unknown> | undefined;
  const inferredClassification: LocalFilesClassification = fc
    ? {
        docsOnly:
          (fc['docsOnly'] as boolean | undefined) ??
          (fc['changesWorkflows'] === undefined && false),
        hasTests: hasClassifiedTests(fc),
        hasDependencies:
          (fc['hasDependencies'] as boolean | undefined) ??
          (fc['changesDependencies'] as boolean | undefined),
        hasWorkflows:
          (fc['hasWorkflows'] as boolean | undefined) ??
          (fc['changesWorkflows'] as boolean | undefined),
        hasAuth:
          (fc['hasAuth'] as boolean | undefined) ?? (fc['changesAuth'] as boolean | undefined),
        hasInfra:
          (fc['hasInfra'] as boolean | undefined) ?? (fc['changesInfra'] as boolean | undefined),
        hasSecrets:
          (fc['hasSecrets'] as boolean | undefined) ??
          (fc['secretFilesDetected'] as boolean | undefined),
      }
    : changedFiles
      ? toLocalClassification(classifyFiles(changedFiles))
      : {};
  const classification: LocalFilesClassification =
    diffContent && detectSecretPatterns(diffContent).length > 0
      ? { ...inferredClassification, hasSecrets: true }
      : inferredClassification;

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
