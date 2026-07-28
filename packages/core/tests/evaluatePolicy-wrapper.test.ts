import { describe, expect, it } from 'vitest';
import { evaluatePolicyFromEvent } from '../src/index.js';
import type { AgentOwnersPolicy } from '../src/types.js';

describe('simplified evaluatePolicyFromEvent API', () => {
  it('infers event and file actions before applying policy rules', () => {
    const policy: AgentOwnersPolicy = {
      version: 1,
      rules: [
        {
          name: 'Block dependency changes',
          when: { actions: ['modify_dependencies'] },
          effect: 'block',
          reason: 'Dependency changes require review.',
        },
      ],
      defaults: { unknown_agent: 'require_approval' },
    };

    const decision = evaluatePolicyFromEvent({
      policy,
      changedFiles: ['package.json'],
      event: { eventType: 'pull_request.opened', actor: 'unknown-user' },
    });

    expect(decision.detectedActions).toEqual(['open_pr', 'modify_dependencies']);
    expect(decision.effect).toBe('block');
    expect(decision.matchedRules.map((rule) => rule.name)).toEqual(['Block dependency changes']);
  });
});
