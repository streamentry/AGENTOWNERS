import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  agentOwnersPolicySchema,
  classifyFiles,
  detectAgent,
  evaluatePolicy,
  inferActions,
  parsePolicy,
  type AgentOwnersPolicy,
  type GitHubEventType,
} from '../src/index.js';

type DecisionFixture = {
  id: string;
  invariant: string;
  outcome: 'decision';
  policy: unknown;
  input: {
    eventType: GitHubEventType;
    actor: string;
    changedFiles: string[];
    prTitle?: string;
    prBody?: string;
    diffLinesCount?: number;
  };
  expected: {
    effect: 'allow' | 'require_approval' | 'block';
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    detectedActions: string[];
    matchedRuleEffects: string[];
  };
};

type ValidationFixture = {
  id: string;
  invariant: string;
  outcome: 'validation_error';
  policy: unknown;
  expected: {
    issuePath: string[];
    messageIncludes: string;
  };
};

type AdversarialFixture = DecisionFixture | ValidationFixture;

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'adversarial-corpus.json',
);
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as AdversarialFixture[];

function evaluateFixture(fixture: DecisionFixture) {
  const policy: AgentOwnersPolicy = parsePolicy(fixture.policy);
  const filesClassification = classifyFiles(fixture.input.changedFiles);
  const agentDetection = detectAgent({
    actor: fixture.input.actor,
    prTitle: fixture.input.prTitle,
    prBody: fixture.input.prBody,
    policy,
  });
  const detectedActions = inferActions({
    eventType: fixture.input.eventType,
    changedFiles: fixture.input.changedFiles,
    filesClassification,
  });

  return evaluatePolicy({
    policy,
    agentDetection,
    detectedActions,
    changedFiles: fixture.input.changedFiles,
    filesClassification,
    actor: fixture.input.actor,
    prTitle: fixture.input.prTitle,
    prBody: fixture.input.prBody,
    diffLinesCount: fixture.input.diffLinesCount,
  });
}

describe('adversarial policy corpus', () => {
  for (const fixture of fixtures) {
    it(`${fixture.id}: ${fixture.invariant}`, () => {
      if (fixture.outcome === 'validation_error') {
        const result = agentOwnersPolicySchema.safeParse(fixture.policy);
        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: fixture.expected.issuePath,
              message: expect.stringContaining(fixture.expected.messageIncludes),
            }),
          ]),
        );
        return;
      }

      const decision = evaluateFixture(fixture);
      expect(decision.effect).toBe(fixture.expected.effect);
      expect(decision.riskScore).toBe(fixture.expected.riskScore);
      expect(decision.riskLevel).toBe(fixture.expected.riskLevel);
      expect(decision.detectedActions).toEqual(fixture.expected.detectedActions);
      expect(decision.matchedRules.map((rule) => rule.effect)).toEqual(
        fixture.expected.matchedRuleEffects,
      );
    });
  }
});
