// Risk scoring — spec section 14

import type {
  AgentAction,
  AgentDetectionConfidence,
  AgentIdentityTrust,
  RiskLevel,
} from './types.js';
import type { FilesClassification } from './classifier.js';

export type RiskScoringInput = {
  filesClassification: FilesClassification;
  diffLinesCount?: number;
  detectedActions: AgentAction[];
  agentConfidence: AgentDetectionConfidence;
  agentIdentityTrust?: AgentIdentityTrust;
};

export function computeRiskScore(input: RiskScoringInput): { score: number; level: RiskLevel } {
  const {
    filesClassification,
    diffLinesCount,
    detectedActions,
    agentConfidence,
    agentIdentityTrust,
  } = input;
  let score = 0;

  // File-based scoring
  if (filesClassification.docsOnly) {
    score += 5;
  }
  if (filesClassification.testsOnly) {
    score += 10;
  }
  if (filesClassification.changesDependencies) {
    score += 30;
  }
  if (filesClassification.changesWorkflows) {
    score += 50;
  }
  if (filesClassification.changesAuth) {
    score += 50;
  }
  if (filesClassification.changesInfra) {
    score += 40;
  }

  // Check permissions changed via detected actions
  if (detectedActions.includes('change_permissions')) {
    score += 60;
  }

  // Secrets
  if (filesClassification.secretFilesDetected || detectedActions.includes('touch_secrets')) {
    score += 80;
  }

  // Diff size scoring
  if (diffLinesCount !== undefined) {
    if (diffLinesCount < 50) {
      score += 5;
    } else if (diffLinesCount <= 300) {
      score += 15;
    } else {
      score += 30;
    }
  }

  // Agent confidence
  if (agentConfidence !== 'confirmed' || agentIdentityTrust === 'unverified') {
    score += 20;
  }
  // agent_confirmed: +0

  // Blocked action detected
  const blockedActions: AgentAction[] = [
    'edit_workflows',
    'touch_secrets',
    'change_permissions',
    'merge_pr',
  ];
  const hasBlockedAction = detectedActions.some((a) => blockedActions.includes(a));
  if (hasBlockedAction) {
    score += 100;
  }

  const cappedScore = Math.min(score, 100);
  const level = scoreToLevel(cappedScore);
  return { score: cappedScore, level };
}

function scoreToLevel(score: number): RiskLevel {
  if (score <= 20) return 'low';
  if (score <= 49) return 'medium';
  if (score <= 79) return 'high';
  return 'critical';
}
