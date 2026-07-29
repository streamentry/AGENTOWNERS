import { describe, expect, it } from 'vitest';
import type { AgentDetectionResult } from '@agent-owners/core';
import { applyKnownAgentActorEvidence } from '../src/agent-evidence.js';

const unknownDetection: AgentDetectionResult = {
  confidence: 'unknown',
  signals: [],
};

describe('known-agent-actors evidence', () => {
  it('marks a configured actor as likely without assigning an agent identity', () => {
    expect(
      applyKnownAgentActorEvidence(unknownDetection, 'release-bot', ['release-bot']),
    ).toEqual({
      confidence: 'likely',
      signals: ['known-agent-actors input: release-bot'],
    });
  });

  it.each(['confirmed', 'likely', 'possible'] as const)(
    'does not downgrade an existing %s detection',
    (confidence) => {
      const detection: AgentDetectionResult = {
        agentName: 'configured-agent',
        confidence,
        signals: ['existing signal'],
      };

      expect(applyKnownAgentActorEvidence(detection, 'release-bot', ['release-bot'])).toBe(
        detection,
      );
    },
  );

  it('does not mark an actor that is absent from the configured list', () => {
    expect(applyKnownAgentActorEvidence(unknownDetection, 'other-bot', ['release-bot'])).toBe(
      unknownDetection,
    );
  });
});
