import type { AgentDetectionResult } from '@agent-owners/core';

/**
 * Keep workflow-provided actor hints as forgeable evidence.
 * Workflow files are contributor-controlled on pull_request events, so this
 * input must never create a confirmed identity or an agent policy name.
 */
export function applyKnownAgentActorEvidence(
  detection: AgentDetectionResult,
  actor: string,
  configuredActors: string[],
): AgentDetectionResult {
  if (detection.confidence !== 'unknown' || !configuredActors.includes(actor)) {
    return detection;
  }

  return {
    ...detection,
    confidence: 'likely',
    signals: [...detection.signals, `known-agent-actors input: ${actor}`],
  };
}
