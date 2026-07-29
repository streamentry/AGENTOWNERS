import { describe, it, expect } from 'vitest';
import {
  detectAgent,
  isKnownBotActor,
  matchesAgentPolicy,
  KNOWN_BOT_ACTORS,
} from '../src/detection.js';
import type { AgentOwnersPolicy } from '../src/types.js';

const basePolicy: AgentOwnersPolicy = {
  version: 1,
  agents: {
    'my-agent': {
      match: {
        actors: ['my-bot[bot]'],
      },
    },
  },
};

describe('isKnownBotActor', () => {
  it('returns true for all known bot actors', () => {
    for (const actor of KNOWN_BOT_ACTORS) {
      expect(isKnownBotActor(actor)).toBe(true);
    }
  });

  it('returns false for unknown actors', () => {
    expect(isKnownBotActor('some-human')).toBe(false);
    expect(isKnownBotActor('unknown[bot]')).toBe(false);
  });
});

describe('matchesAgentPolicy', () => {
  it('returns agent name when actor matches', () => {
    expect(matchesAgentPolicy('my-bot[bot]', basePolicy)).toBe('my-agent');
  });

  it('returns null when actor does not match', () => {
    expect(matchesAgentPolicy('other-actor', basePolicy)).toBeNull();
  });

  it('returns null when policy has no agents', () => {
    expect(matchesAgentPolicy('anyone', { version: 1 })).toBeNull();
  });
});

describe('detectAgent', () => {
  it('policy match → confirmed with agentName', () => {
    const result = detectAgent({ actor: 'my-bot[bot]', policy: basePolicy });
    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBe('my-agent');
    expect(result.signals.some((s) => s.includes('policy match'))).toBe(true);
  });

  it('policy match takes priority over known bot actor', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'special-copilot': {
          match: { actors: ['github-copilot[bot]'] },
        },
      },
    };
    const result = detectAgent({ actor: 'github-copilot[bot]', policy });
    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBe('special-copilot');
  });

  it('github-copilot[bot] → confirmed without policy', () => {
    const result = detectAgent({ actor: 'github-copilot[bot]' });
    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBeUndefined();
    expect(result.signals.some((s) => s.includes('known bot actor'))).toBe(true);
  });

  it('dependabot[bot] → confirmed', () => {
    const result = detectAgent({ actor: 'dependabot[bot]' });
    expect(result.confidence).toBe('confirmed');
  });

  it('commit with Co-Authored-By: Claude → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      commitMessages: ['feat: add feature\n\nCo-Authored-By: Claude <noreply@anthropic.com>'],
    });
    expect(result.confidence).toBe('likely');
    expect(result.signals.some((s) => s.includes('Co-Authored-By: Claude'))).toBe(true);
  });

  it('PR body with 🤖 Generated with → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'This PR was created.\n\n🤖 Generated with Claude Code',
    });
    expect(result.confidence).toBe('likely');
  });

  it('PR body with <!-- agentowners marker → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'Some description\n<!-- agentowners: claude -->',
    });
    expect(result.confidence).toBe('likely');
  });

  it('PR body with Co-authored-by: somebot[bot] → likely', () => {
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'Co-authored-by: mybot[bot]',
    });
    expect(result.confidence).toBe('likely');
  });

  it('label ai-generated → possible', () => {
    const result = detectAgent({
      actor: 'human-user',
      labels: ['ai-generated'],
    });
    expect(result.confidence).toBe('possible');
    expect(result.signals.some((s) => s.includes('ai-generated'))).toBe(true);
  });

  it('label claude → possible', () => {
    const result = detectAgent({ actor: 'human-user', labels: ['claude'] });
    expect(result.confidence).toBe('possible');
  });

  it('unknown actor, no signals → unknown', () => {
    const result = detectAgent({ actor: 'regular-human' });
    expect(result.confidence).toBe('unknown');
    expect(result.signals).toHaveLength(0);
  });

  it('multiple signals all reported', () => {
    const result = detectAgent({
      actor: 'human-user',
      commitMessages: ['Claude Code did this', 'Generated with AI'],
      prBody: '🤖 Generated with Claude',
      labels: ['ai-generated'],
    });
    expect(result.confidence).toBe('likely');
    expect(result.signals.length).toBeGreaterThan(1);
  });

  it('policy body pattern match → likely because body text is spoofable', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'code-agent': {
          match: {
            bodyPatterns: ['automated pull request'],
          },
        },
      },
    };
    const result = detectAgent({
      actor: 'human-user',
      prBody: 'This is an automated pull request from our CI system.',
      policy,
    });
    expect(result.confidence).toBe('likely');
    expect(result.agentName).toBe('code-agent');
  });

  it('policy label match → possible candidate agent', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'release-agent': {
          match: {
            labels: ['automation:release-agent'],
          },
        },
      },
    };

    const result = detectAgent({
      actor: 'human-user',
      labels: ['automation:release-agent'],
      policy,
    });

    expect(result.confidence).toBe('possible');
    expect(result.agentName).toBe('release-agent');
    expect(result.signals).toContain(
      'policy label match: agents.release-agent.match.labels',
    );
  });

  it('policy label match names the configured candidate over built-in evidence', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'custom-agent': {
          match: {
            labels: ['claude'],
          },
        },
      },
    };

    const result = detectAgent({
      actor: 'human-user',
      labels: ['claude'],
      policy,
    });

    expect(result).toEqual({
      agentName: 'custom-agent',
      confidence: 'possible',
      signals: ['policy label match: agents.custom-agent.match.labels'],
    });
  });

  it('configured title pattern is likely evidence, not confirmed identity', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'title-agent': {
          match: { prTitlePatterns: ['automated release'] },
        },
      },
    };

    const result = detectAgent({
      actor: 'human-user',
      prTitle: 'chore: automated release',
      policy,
    });

    expect(result.confidence).toBe('likely');
    expect(result.agentName).toBe('title-agent');
    expect(result.signals).toContain('policy title pattern match: agents.title-agent');
  });

  it('known bot actor remains confirmed despite a matching body pattern', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'body-agent': {
          match: { bodyPatterns: ['generated by the bot'] },
        },
      },
    };

    const result = detectAgent({
      actor: 'github-copilot[bot]',
      prBody: 'generated by the bot',
      policy,
    });

    expect(result.confidence).toBe('confirmed');
    expect(result.agentName).toBeUndefined();
    expect(result.signals).toContain('known bot actor: github-copilot[bot]');
  });

  it('configured commit email identifies a likely candidate agent', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'commit-agent': {
          match: {
            commitEmails: ['agent@example.invalid'],
          },
        },
      },
    };

    const result = detectAgent({
      actor: 'human-user',
      commitEmails: ['agent@example.invalid'],
      policy,
    });

    expect(result).toEqual({
      agentName: 'commit-agent',
      confidence: 'likely',
      signals: ['policy commit email match: agents.commit-agent.match.commitEmails'],
    });
  });

  it('configured commit name identifies a likely candidate agent', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'named-agent': {
          match: {
            commitNames: ['Automation Bot'],
          },
        },
      },
    };

    const result = detectAgent({
      actor: 'human-user',
      commitNames: ['Automation Bot'],
      policy,
    });

    expect(result.confidence).toBe('likely');
    expect(result.agentName).toBe('named-agent');
    expect(result.signals).toContain(
      'policy commit name match: agents.named-agent.match.commitNames',
    );
  });

  it('policy body pattern matches an issue comment body', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'comment-agent': {
          match: {
            bodyPatterns: ['generated review response'],
          },
        },
      },
    };

    const result = detectAgent({
      actor: 'human-user',
      commentBody: 'This is a generated review response.',
      policy,
    });

    expect(result.confidence).toBe('likely');
    expect(result.agentName).toBe('comment-agent');
  });

  it('policy body pattern matches an issue body without treating it as a PR body', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'issue-agent': {
          match: {
            bodyPatterns: ['generated issue report'],
          },
        },
      },
    };

    const result = detectAgent({
      actor: 'human-user',
      issueBody: 'This is a generated issue report.',
      policy,
    });

    expect(result.confidence).toBe('likely');
    expect(result.agentName).toBe('issue-agent');
  });

  it('agent signature in an issue comment body is likely evidence', () => {
    const result = detectAgent({
      actor: 'human-user',
      commentBody: '🤖 Generated with Codex',
    });

    expect(result.confidence).toBe('likely');
  });

  it('malformed configured patterns fail closed without aborting detection', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        malformed: {
          match: {
            bodyPatterns: ['['],
            prTitlePatterns: ['(?'],
          },
        },
      },
    };

    expect(
      detectAgent({
        actor: 'unrecognized-user',
        prTitle: 'Any title',
        prBody: 'Any body',
        policy,
      }),
    ).toEqual({
      confidence: 'unknown',
      signals: [],
    });
  });

  it('continues to valid configured patterns after a malformed sibling', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        'code-agent': {
          match: {
            bodyPatterns: ['[', 'generated safely'],
          },
        },
      },
    };

    const result = detectAgent({
      actor: 'unrecognized-user',
      prBody: 'Generated safely by the build agent.',
      policy,
    });

    expect(result.confidence).toBe('likely');
    expect(result.agentName).toBe('code-agent');
  });
});
