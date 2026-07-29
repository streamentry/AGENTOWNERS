import { describe, expect, it, vi } from 'vitest';
import { renderSarif } from '../src/sarif.js';
import type { Decision } from '../src/types.js';

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    effect: 'require_approval',
    matchedRules: [
      {
        name: 'Review auth changes',
        effect: 'require_approval',
        reason: 'Authentication changes require human review.',
        matchedFiles: ['src/auth/session token.ts', 'src/auth/login.ts'],
      },
    ],
    detectedActions: ['open_pr', 'modify_auth'],
    riskScore: 65,
    riskLevel: 'high',
    requiredReviewers: ['@security'],
    labelsToApply: ['needs-human-review'],
    explanation: 'Human review is required.',
    ...overrides,
  };
}

describe('renderSarif', () => {
  it('emits deterministic SARIF 2.1.0 without timestamps or absolute paths', () => {
    const first = renderSarif(decision());
    const second = renderSarif(decision());

    expect(first).toEqual(second);
    expect(first.version).toBe('2.1.0');
    expect(first.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    expect(JSON.stringify(first)).not.toMatch(/timestamp|\/Volumes\/|file:\/\//);
  });

  it('emits no results for an allowed decision', () => {
    const output = renderSarif(
      decision({
        effect: 'allow',
        matchedRules: [
          {
            name: 'Allow docs',
            effect: 'allow',
            reason: 'Documentation is allowed.',
            matchedFiles: ['README.md'],
          },
        ],
      }),
    );

    expect(output.runs[0].results).toEqual([]);
    expect(output.runs[0].tool.driver.rules).toEqual([]);
    expect(output.runs[0].properties?.decision).toBe('allow');
  });

  it.each([
    ['require_approval', 'warning'],
    ['block', 'error'],
  ] as const)('maps %s to SARIF level %s', (effect, level) => {
    const output = renderSarif(
      decision({
        effect,
        matchedRules: [
          {
            name: 'Decision rule',
            effect,
            reason: 'Policy decision.',
          },
        ],
      }),
    );

    expect(output.runs[0].results.every((result) => result.level === level)).toBe(true);
  });

  it('emits every non-allow matched rule at its own severity', () => {
    const output = renderSarif(
      decision({
        effect: 'block',
        matchedRules: [
          {
            name: 'Allow docs',
            effect: 'allow',
            reason: 'Documentation is allowed.',
          },
          {
            name: 'Review auth',
            effect: 'require_approval',
            reason: 'Authentication changes require review.',
          },
          {
            name: 'Block workflow',
            effect: 'block',
            reason: 'Workflow changes are blocked.',
          },
        ],
      }),
    );

    expect(output.runs[0].results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: { text: 'Workflow changes are blocked.' },
          level: 'error',
        }),
        expect.objectContaining({
          message: { text: 'Authentication changes require review.' },
          level: 'warning',
        }),
      ]),
    );
  });

  it('represents an agent-action block even when another rule only requires approval', () => {
    const output = renderSarif(
      decision({
        effect: 'block',
        matchedRules: [
          {
            name: 'Review source changes',
            effect: 'require_approval',
            reason: 'Source changes require review.',
          },
        ],
      }),
    );

    expect(output.runs[0].results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AGENTOWNERS/DEFAULT',
          level: 'error',
        }),
        expect.objectContaining({
          level: 'warning',
          message: { text: 'Source changes require review.' },
        }),
      ]),
    );
  });

  it('uses stable opaque rule IDs and one result per matched file', () => {
    const output = renderSarif(decision());
    const [rule] = output.runs[0].tool.driver.rules;

    expect(rule.id).toMatch(/^AGENTOWNERS\/[0-9a-f]{16}$/);
    expect(output.runs[0].results).toHaveLength(2);
    expect(output.runs[0].results.every((result) => result.ruleId === rule.id)).toBe(true);
    expect(
      output.runs[0].results.map(
        (result) => result.locations?.[0].physicalLocation.artifactLocation.uri,
      ),
    ).toEqual(['src/auth/login.ts', 'src/auth/session%20token.ts']);
    expect(output.runs[0].results[0].partialFingerprints?.['agentowners/v1']).toMatch(
      /^[0-9a-f]{16}$/,
    );
  });

  it('preserves distinct rules that happen to share a display name', () => {
    const output = renderSarif(
      decision({
        effect: 'block',
        matchedRules: [
          {
            name: 'Sensitive change',
            effect: 'require_approval',
            reason: 'Auth changes require review.',
          },
          {
            name: 'Sensitive change',
            effect: 'block',
            reason: 'Workflow changes are blocked.',
          },
        ],
      }),
    );

    const ids = output.runs[0].tool.driver.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(2);
    expect(output.runs[0].results).toHaveLength(2);
    expect(new Set(output.runs[0].results.map((result) => result.ruleId)).size).toBe(2);
  });

  it('emits a synthetic result when a non-allow decision has no matched rule', () => {
    const output = renderSarif(decision({ effect: 'block', matchedRules: [] }));

    expect(output.runs[0].tool.driver.rules[0].id).toBe('AGENTOWNERS/DEFAULT');
    expect(output.runs[0].results).toMatchObject([
      {
        ruleId: 'AGENTOWNERS/DEFAULT',
        level: 'error',
        message: { text: 'Repository policy blocks this agent action.' },
      },
    ]);
  });

  it('omits unsafe file locations while preserving the policy result', () => {
    const output = renderSarif(
      decision({
        matchedRules: [
          {
            name: 'Unsafe paths',
            effect: 'require_approval',
            reason: 'Path fixture.',
            matchedFiles: [
              '/etc/passwd',
              '../secret',
              'C:\\secret.txt',
              'src\\file.ts',
              'src/./file.ts',
              'src/\ud800.ts',
            ],
          },
        ],
      }),
    );

    expect(output.runs[0].results).toHaveLength(1);
    expect(output.runs[0].results[0].locations).toBeUndefined();
  });

  it('does not depend on host-locale collation', () => {
    const localeCompare = vi
      .spyOn(String.prototype, 'localeCompare')
      .mockImplementation(() => {
        throw new Error('host locale must not affect SARIF ordering');
      });

    try {
      expect(() =>
        renderSarif(
          decision({
            matchedRules: [
              {
                name: 'Rule B',
                effect: 'require_approval',
                reason: 'B.',
                matchedFiles: ['z.ts', 'a.ts'],
              },
              {
                name: 'Rule A',
                effect: 'require_approval',
                reason: 'A.',
                matchedFiles: ['b.ts'],
              },
            ],
          }),
        ),
      ).not.toThrow();
    } finally {
      localeCompare.mockRestore();
    }
  });

  it('sorts rules and files so input ordering does not change output', () => {
    const rules = [
      {
        name: 'Z rule',
        effect: 'require_approval' as const,
        reason: 'Z.',
        matchedFiles: ['z.ts', 'a.ts'],
      },
      {
        name: 'A rule',
        effect: 'require_approval' as const,
        reason: 'A.',
        matchedFiles: ['b.ts'],
      },
    ];

    expect(renderSarif(decision({ matchedRules: rules }))).toEqual(
      renderSarif(decision({ matchedRules: [...rules].reverse() })),
    );
  });
});
